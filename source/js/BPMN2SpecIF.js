


// Durchlaufen der XML Datei und Überführen der Elemente in das SpecIF Format
function BPMN2Specif( xmlString, opts ) {
	var parser = new DOMParser();
	var xmlDoc = parser.parseFromString(xmlString, "text/xml");
	var typ, id, name, source, target, stereotype;
	var elements = new Array();
	var i, j, x, y;

	x = xmlDoc.querySelectorAll("collaboration");
	typ = x[0].nodeName; // Name des Diagramms
	id = x[0].getAttribute("id");
	name = opts.fileName.split(".")[0];
	elements.push(resourceFinder(typ, id, name, source, target));

	y = xmlDoc.querySelectorAll("process"); // Prozesse im Diagramm umwandeln
	x = x[0].childNodes;
	for (i = 0; i < x.length; i++) {
		if (x[i].nodeName.includes("participant") == true) {
			for (j = 0; j < y.length; j++) {
				if (y[j].nodeName.includes("process") == true) {
					if (x[i].getAttribute("processRef") == y[j].getAttribute("id")) {
						elements = elements.concat(analyzeProcess(y[j], x[i].getAttribute("id"), x[i].getAttribute("name")));
					}
				}
			}
		}
	}

	for (i = 0; i < x.length; i++) { // Nachrichtenflüsse umwandeln
		if (x[i].nodeName.includes("messageFlow") == true) {
			typ = x[i].nodeName;
			id = x[i].getAttribute("id");
			name = x[i].getAttribute("name");
			source = x[i].getAttribute("sourceRef");
			target = x[i].getAttribute("targetRef");
			elements = elements.concat(statementFinder(elements, typ, id, name, source, target));
		}
	}

	id = 1;
	for (i = 1; i < elements.length; i++) { // Beziehungen zwischen Diagramm und Elementen herstellen
		if (elements[i].resourceType == "RT-Act" || elements[i].resourceType == "RT-Evt" || elements[i].resourceType == "RT-Sta") {
			elements.push({
				id: "Diagram_shows_" + id,
				title: "SpecIF:shows",
				statementType: "ST-Visibility",
				subject: elements[0].id,
				object: elements[i].id,
				changedAt: opts.fileDate
			});
			id++;
		}
	}
	var clonedArray = JSON.parse(JSON.stringify(elements));
	console.log(elements);
	jsonBuilder( elements, opts );
	return

// called functions:	
	// Analysieren eines Prozesses
	function analyzeProcess(nodeList, participantId, name) {
		var typ, id, name, source, target, stereotype;
		var i;
		x = nodeList;
		var erg = new Array();

		if (name == "Hauptprozess") {
			return erg;
		}
		erg.push(resourceFinder(x.nodeName, participantId, name, null, null, "participant"));

		x = x.childNodes;
		for (i = 0; i < x.length; i++) { // Erstellen aller Ressourcen und Platzhaltern für Gateways
			if (x[i].nodeName != "#text" && x[i].nodeName != "bpmn:sequenceFlow" && x[i].nodeName != "sequenceFlow" && x[i].nodeName != "extensionElements" && x[i].nodeName != "laneSet" && x[i].nodeName != "documentation") {
				typ = x[i].nodeName;
				id = x[i].getAttribute("id");
				name = x[i].getAttribute("name");
				source = x[i].getAttribute("sourceRef");
				target = x[i].getAttribute("targetRef");
				erg.push(resourceFinder(typ, id, name, source, target, stereotype));
			}
		}

		for (i = 0; i < x.length; i++) { // Erstellen der Statements zwischen den Ressourcen und Platzhaltern für Gateways
			if (x[i].nodeName == "bpmn:sequenceFlow" || x[i].nodeName == "sequenceFlow") {
				typ = x[i].nodeName;
				id = x[i].getAttribute("id");
				name = x[i].getAttribute("name");
				source = x[i].getAttribute("sourceRef");
				target = x[i].getAttribute("targetRef");
				erg.push(statementFinder(erg, typ, id, name, source, target));
			}
		}

		resolveGateways(erg); // Auflösen der Gateways 

		id = 1;
		for (i = 1; i < erg.length; i++) { // Beziehungen zwischen Prozess Elementen herstellen
			if (erg[i].resourceType == "RT-Act" || erg[i].resourceType == "RT-Evt" || erg[i].resourceType == "RT-Sta") {
				erg.push({
					id: erg[0].id + "_contains_" + id,
					title: "SpecIF:contains",
					statementType: "ST-Containment",
					subject: erg[0].id,
					object: erg[i].id,
					changedAt: opts.fileDate
				});
				id++;
			}
		}

		return erg;
	}


	// Übersetzen der der BPMN-Elemente (außer verbindende Objekte) in SpecIF Ressourcen
	function resourceFinder(typ, id, name, source, target, stereotype) {
		if (typ.includes("bpmn:")) { // Anpassung für BPMN.io, da dort bpmn: im Tag verwendet wird
			typ = typ.split(":")[1];
		}
		if (typeof stereotype == "undefined") {
			stereotype = typ;
		}

		switch (typ) {
			case "collaboration":
				var properties = new Array();
				properties.push({
					title: "dcterms:title",
					propertyType: "PT-Pln-Name",
					value: name
				}, {
					title: "SpecIF:Diagram",
					propertyType: "PT-Pln-Diagram",
					value: "<div><p> Dies ist der hochgeladene BPMN-Prozess" +
						" </p><p class=\"inline-label\"> Model View: </p><div class=\"forImage\" style=\"max-width: 600px;\" > <object " +
						"data=\"BusinessProcess.svg\" type=\"image/svg+xml\" >BusinessProcess</object></div></div>"
				}, {
					title: "SpecIF:Notation",
					propertyType: "PT-Pln-Notation",
					value: "BPMN 2.0 Process Diagram"
				});
				return erg = {
					id: id,
					title: name,
					properties: properties,
					resourceType: "RT-Pln",
					changedAt: opts.fileDate
				};

			case "startEvent":
			case "intermediateThrowEvent":
			case "endEvent":
				var properties = new Array();
				properties.push({
					title: "dcterms:title",
					propertyType: "PT-Evt-Name",
					value: name
				}, {
					title: "SpecIF:Stereotype",
					propertyType: "PT-Evt-Stereotype",
					value: stereotype
				});
				return erg = {
					id: id,
					title: name,
					properties: properties,
					resourceType: "RT-Evt",
					changedAt: opts.fileDate
				};

			case "participant":
			case "process":
			case "task":
			case "userTask":
				var properties = new Array();
				properties.push({
					title: "dcterms:title",
					propertyType: "PT-Act-Name",
					value: name
				}, {
					title: "SpecIF:Stereotype",
					propertyType: "PT-Act-Stereotype",
					value: stereotype
				});
				return erg = {
					id: id,
					title: name,
					properties: properties,
					resourceType: "RT-Act",
					changedAt: opts.fileDate
				};

			case "dataObjectReference":
				var properties = new Array();
				properties.push({
					title: "dcterms:title",
					propertyType: "PT-Sta-Name",
					value: name
				}, {
					title: "SpecIF:Stereotype",
					propertyType: "PT-Sta-Stereotype",
					value: stereotype
				});
				return erg = {
					id: id,
					title: name,
					properties: properties,
					resourceType: "RT-Sta",
					changedAt: opts.fileDate
				};

			case "parallelGateway":
				var incoming = new Array();
				var outgoing = new Array();
				return erg = {
					id: id,
					title: name,
					incoming: incoming,
					outgoing: outgoing,
					resourceType: "parallelGateway",
					changedAt: opts.fileDate
				};

			case "exclusiveGateway":
				var incoming = new Array();
				var outgoing = new Array();
				return erg = {
					id: id,
					title: name,
					incoming: incoming,
					outgoing: outgoing,
					resourceType: "exklusiveGateway",
					changedAt: opts.fileDate
				};

			default:
				return "unknown element";
		}
	}

	// Übersetzen eines Nachrichten- oder Sequenzflusses in SpecIF-Elemente
	function statementFinder(elements, typ, id, name, source, target) {
		if (typ.includes("bpmn:")) {
			typ = typ.split(":")[1];
		}
		var subject = elements.find(function(resource) {
			return resource.id == source;
		});
		var object = elements.find(function(resource) {
			return resource.id == target;
		});

		switch (typ) {
			case "messageFlow":
				var erg = [];
				erg.push(resourceFinder("dataObjectReference", id + "_1", name, null, null, "messageFlow"));
				erg.push({
					id: id + "_2",
					title: "SpecIF:writes",
					statementType: "ST-Writing",
					subject: subject.id,
					object: id + "_1",
					changedAt: opts.fileDate
				});
				erg.push({
					id: id + "_3",
					title: "SpecIF:reads",
					statementType: "ST-Reading",
					subject: object.id,
					object: id + "_1",
					changedAt: opts.fileDate
				});

				var statementCount, participant;
				var i;
				statementCount = 0;
				if (subject.properties[1].value == "participant") { // Ist das Subjekt ein Pool bzw. Participant?
					for (i = 0; i < elements.length; i++) {
						if (elements[i].title == "SpecIF:contains" && elements[i].subject == subject.id) {
							statementCount++;
						}
					}
					erg.push({
						id: subject.id + "_contains_" + (statementCount + 1),
						title: "SpecIF:contains",
						statementType: "ST-Containment",
						subject: subject.id,
						object: id + "_1",
						changedAt: opts.fileDate
					});
				} else {
					for (i = 0; i < elements.length; i++) { // Schleife zum Finden des Teilnehmers bzw. Pools
						if (elements[i].title == "SpecIF:contains" && elements[i].object == subject.id) {
							participant = elements.find(function(resource) {
								return resource.id == elements[i].subject;
							});
						}
					}
					for (i = 0; i < elements.length; i++) {
						if (elements[i].title == "SpecIF:contains" && elements[i].subject == participant.id) {
							statementCount++;
						}
					}
					erg.push({
						id: participant.id + "_contains_" + (statementCount + 1),
						title: "SpecIF:contains",
						statementType: "ST-Containment",
						subject: participant.id,
						object: id + "_1",
						changedAt: opts.fileDate
					});
				}
				statementCount = 0;
				if (object.properties[1].value == "participant") { // Ist das Objekt ein Pool bzw. Participant?
					for (i = 0; i < elements.length; i++) {
						if (elements[i].title == "SpecIF:contains" && elements[i].subject == object.id) {
							statementCount++;
						}
					}
					erg.push({
						id: object.id + "_contains_" + (statementCount + 1),
						title: "SpecIF:contains",
						statementType: "ST-Containment",
						subject: object.id,
						object: id + "_1",
						changedAt: opts.fileDate
					});
				} else {
					for (i = 0; i < elements.length; i++) { // Schleife zum Finden des Teilnehmers bzw. Pools
						if (elements[i].title == "SpecIF:contains" && elements[i].object == object.id) {
							participant = elements.find(function(resource) {
								return resource.id == elements[i].subject;
							});
						}
					}
					for (i = 0; i < elements.length; i++) {
						if (elements[i].title == "SpecIF:contains" && elements[i].subject == participant.id) {
							statementCount++;
						}
					}
					erg.push({
						id: participant.id + "_contains_" + (statementCount + 1),
						title: "SpecIF:contains",
						statementType: "ST-Containment",
						subject: participant.id,
						object: id + "_1",
						changedAt: opts.fileDate
					});
				}

				return erg;

			case "sequenceFlow":
				if (subject.resourceType == "RT-Act" && object.resourceType == "RT-Act") {
					return erg = {
						id: id,
						title: "SpecIF:precedes",
						statementType: "ST-Preceding",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					};
				}
				if ((subject.resourceType == "RT-Act" || subject.resourceType == "RT-Evt") && object.resourceType == "RT-Evt") {
					return erg = {
						id: id,
						title: "SpecIF:signals",
						statementType: "ST-Signalling",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					};
				}
				if (subject.resourceType == "RT-Evt" && object.resourceType == "RT-Act") {
					return erg = {
						id: id,
						title: "SpecIF:triggers",
						statementType: "ST-Triggering",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					};
				}
				if (subject.resourceType == "parallelGateway" || subject.resourceType == "exklusiveGateway") {
					subject.outgoing.push({
						id: id,
						title: name,
						statementType: "gatewayFlow",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					});
				}
				if (object.resourceType == "parallelGateway" || object.resourceType == "exklusiveGateway") {
					object.incoming.push({
						id: id,
						title: name,
						statementType: "gatewayFlow",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					});
				}

				return erg = {
					id: id,
					title: name,
					statementType: "gatewayFlow",
					subject: subject.id,
					object: object.id,
					changedAt: opts.fileDate
				};

			default:
				return "unknown element";
		}
	}

	// Ressourcen und Statements aus den Gateways und ihren Sequenzflüssen herstellen
	// ! Funktioniert nicht bei direkt aufeinanderfolgenden Gateways !
	function resolveGateways(elements) {
		for (i = 0; i < elements.length; i++) {
			if (elements[i].resourceType == "parallelGateway" && elements[i].incoming.length == 1) { // Paralleles Gateway ausgehend 1 -> x
				for (j = 0; j < elements[i].outgoing.length; j++) {
					elements[i].outgoing[j].subject = elements[i].incoming[0].subject;
					elements.push(statementFinder(elements, "sequenceFlow", elements[i].outgoing[j].id, "", elements[i].outgoing[j].subject, elements[i].outgoing[j].object));
				}
			}

			if (elements[i].resourceType == "parallelGateway" && elements[i].outgoing.length == 1) { // Paralleles Gateway eingehend x -> 1
				elements.push(resourceFinder("task", elements[i].id, "Warte auf vorherige Elemente", null, null, "parallelGateway"));
				elements[i].id = null;
				elements.push(statementFinder(elements, "sequenceFlow", elements[i].outgoing[0].id, "", elements[i].outgoing[0].subject, elements[i].outgoing[0].object));
				for (j = 0; j < elements[i].incoming.length; j++) {
					elements.push(statementFinder(elements, "sequenceFlow", elements[i].incoming[j].id, "", elements[i].incoming[j].subject, elements[i].incoming[j].object));
				}
			}

			if (elements[i].resourceType == "exklusiveGateway" && elements[i].incoming.length == 1) { // Exklusives Gateway ausgehend 1 -> x
				for (j = 0; j < elements[i].outgoing.length; j++) {
					elements.push(resourceFinder("intermediateThrowEvent", elements[i].id + "_" + j, elements[i].outgoing[j].title, null, null, "exklusiveGateway"));
					elements.push(statementFinder(elements, "sequenceFlow", elements[i].incoming[0].id + "_" + j, "", elements[i].incoming[0].subject, elements[i].id + "_" + j));
					elements.push(statementFinder(elements, "sequenceFlow", elements[i].outgoing[j].id, "", elements[i].id + "_" + j, elements[i].outgoing[j].object));
				}
			}

			if (elements[i].resourceType == "exklusiveGateway" && elements[i].outgoing.length == 1) { // Exklusives Gateway eingehend x -> 1
				for (j = 0; j < elements[i].incoming.length; j++) {
					elements[i].incoming[j].object = elements[i].outgoing[0].object;
					elements.push(statementFinder(elements, "sequenceFlow", elements[i].incoming[j].id, "", elements[i].incoming[j].subject, elements[i].incoming[j].object));
				}
			}
		}

		// entfernen der Gateways
		i = 0
		while (i != elements.length) {
			if (elements[i].statementType == "gatewayFlow" || elements[i].resourceType == "parallelGateway" || elements[i].resourceType == "exklusiveGateway") {
				elements.splice(i, 1);
			} else {
				i++
			}
		}
	}

	// Bauen eines SpecIF Projekts im JSON Format
	function jsonBuilder( elements, opts ) {
		var d = new Date();
		var model = new Object();	// process model in SpecIF/JSON format
		model.id = "BPMN-" + (d.getDate() + "" + d.getMonth() + "" + d.getFullYear() + "" + d.getHours() + "" + d.getMinutes() + "" + d.getSeconds());
		model.title = opts.title;
		model.description = opts.description;
		model.specifVersion = "0.10.3";

		var dataTypes = new Array(); // Benötigte Datentypen werden definiert
		dataTypes.push({
			id: "DT-Integer",
			title: "Integer",
			type: "xs:integer",
			min: -32768,
			max: 32767,
			changedAt: opts.fileDate
		});
		dataTypes.push({
			id: "DT-ShortString",
			title: "String[96]",
			description: "String with length 96",
			type: "xs:string",
			maxLength: 96,
			changedAt: opts.fileDate
		});
		dataTypes.push({
			id: "DT-String",
			title: "String[1024]",
			description: "String with length 1024",
			type: "xs:string",
			maxLength: 1024,
			changedAt: opts.fileDate
		});
		dataTypes.push({
			id: "DT-formattedText",
			title: "xhtml[1024]",
			description: "Formatted String with length 1024",
			type: "xhtml",
			maxLength: 1024,
			changedAt: opts.fileDate
		});

		var resourceTypes = new Array(); // Benötigte Ressourcentypen werden definiert
		resourceTypes.push({
			id: "RT-Pln",
			title: "SpecIF:Diagram",
			description: "A 'Diagram' is a graphical model view with a specific communication purpose, e.g. a business process or system composition.",
			propertyTypes: [{
					id: "PT-Pln-Name",
					title: "dcterms:title",
					dataType: "DT-ShortString",
					changedAt: opts.fileDate
				},
				{
					id: "PT-Pln-Diagram",
					title: "SpecIF:Diagram",
					dataType: "DT-formattedText",
					changedAt: opts.fileDate
				},
				{
					id: "PT-Pln-Notation",
					title: "SpecIF:Notation",
					dataType: "DT-ShortString",
					changedAt: opts.fileDate
				}
			],
			icon: "&#9635;",
			changedAt: opts.fileDate
		});
		resourceTypes.push({
			id: "RT-Act",
			title: "FMC:Actor",
			description: "An 'Actor' is a fundamental model element type representing an active entity, be it an activity, a process step, a function, a system component or a role.",
			propertyTypes: [{
					id: "PT-Act-Name",
					title: "dcterms:title",
					dataType: "DT-ShortString",
					changedAt: opts.fileDate
				},
				{
					id: "PT-Act-Stereotype",
					title: "SpecIF:Stereotype",
					dataType: "DT-ShortString",
					changedAt: opts.fileDate
				}
			],
			icon: "&#9632;",
			changedAt: opts.fileDate
		})
		resourceTypes.push({
			id: "RT-Sta",
			title: "FMC:State",
			description: "A 'State' is a fundamental model element type representing a passive entity, be it a value, a condition, an information storage or even a physical shape.",
			propertyTypes: [{
					id: "PT-Sta-Name",
					title: "dcterms:title",
					dataType: "DT-ShortString",
					changedAt: opts.fileDate
				},
				{
					id: "PT-Sta-Stereotype",
					title: "SpecIF:Stereotype",
					dataType: "DT-ShortString",
					changedAt: opts.fileDate
				}
			],
			icon: "&#9679;",
			changedAt: opts.fileDate
		})
		resourceTypes.push({
			id: "RT-Evt",
			title: "FMC:Event",
			description: "An 'Event' is a fundamental model element type representing a time reference, a change in condition/value or more generally a synchronisation primitive.",
			propertyTypes: [{
					id: "PT-Evt-Name",
					title: "dcterms:title",
					dataType: "DT-ShortString",
					changedAt: opts.fileDate
				},
				{
					id: "PT-Evt-Stereotype",
					title: "SpecIF:Stereotype",
					dataType: "DT-ShortString",
					changedAt: opts.fileDate
				}
			],
			icon: "&#9830;",
			changedAt: opts.fileDate
		})
		resourceTypes.push({
			id: "RT-Not",
			title: "SpecIF:Note",
			description: "A 'Note' is additional information by the author referring to any resource.",
			propertyTypes: [{
				id: "PT-Not-Name",
				title: "dcterms:title",
				dataType: "DT-ShortString",
				changedAt: opts.fileDate
			}],
			changedAt: opts.fileDate
		})
		resourceTypes.push({
			id: "RT-Col",
			title: "SpecIF:Collection",
			description: "A 'Collection' is an arbitrary group of resources linked with a SpecIF:contains statement. It corresponds to a 'Group' in BPMN Diagrams.",
			propertyTypes: [{
				id: "PT-Col-Name",
				title: "dcterms:title",
				dataType: "DT-ShortString",
				changedAt: opts.fileDate
			}],
			changedAt: opts.fileDate
		})
		resourceTypes.push({
			id: "RT-Fld",
			title: "SpecIF:Heading",
			description: "Folders with title and text for chapters or descriptive paragraphs.",
			isHeading: true,
			propertyTypes: [{
				id: "PT-Fld-Name",
				title: "dcterms:title",
				dataType: "DT-ShortString",
				changedAt: opts.fileDate
			}],
			changedAt: opts.fileDate
		})

		var statementTypes = new Array(); // Benötigte Statementtypen werden definiert
		statementTypes.push({
			id: "ST-Visibility",
			title: "SpecIF:shows",
			description: "Relation: Plan shows Model-Element",
			subjectTypes: ["RT-Pln"],
			objectTypes: ["RT-Act", "RT-Sta", "RT-Evt"],
			changedAt: opts.fileDate
		})
		statementTypes.push({
			id: "ST-Containment",
			title: "SpecIF:contains",
			description: "Relation: Model-Element contains Model-Element",
			subjectTypes: ["RT-Act", "RT-Sta", "RT-Evt"],
			objectTypes: ["RT-Act", "RT-Sta", "RT-Evt"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Storage",
			title: "SpecIF:stores",
			description: "Relation: Actor (Role, Function) writes and reads State (Information)",
			subjectTypes: ["RT-Act"],
			objectTypes: ["RT-Sta"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Writing",
			title: "SpecIF:writes",
			description: "Relation: Actor (Role, Function) writes State (Information)",
			subjectTypes: ["RT-Act"],
			objectTypes: ["RT-Sta"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Reading",
			title: "SpecIF:reads",
			description: "Relation: Actor (Role, Function) reads State (Information)",
			subjectTypes: ["RT-Act"],
			objectTypes: ["RT-Sta"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Preceding",
			title: "SpecIF:precedes",
			description: "A FMC:Actor 'precedes' a FMC:Actor; e.g. in a business process or activity flow.",
			subjectTypes: ["RT-Act"],
			objectTypes: ["RT-Act"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Signalling",
			title: "SpecIF:signals",
			description: "A FMC:Actor 'signals' a FMC:Event.",
			subjectTypes: ["RT-Act", "RT-Evt"],
			objectTypes: ["RT-Evt"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Triggering",
			title: "SpecIF:triggers",
			description: "A FMC:Event 'triggers' a FMC:Actor.",
			subjectTypes: ["RT-Evt"],
			objectTypes: ["RT-Act"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-ReferingTo",
			title: "SpecIF:refersTo",
			description: "A SpecIF:Comment, SpecIF:Note or SpecIF:Issue 'refers to' any other resource.",
			subjectTypes: ["RT-Not"],
			objectTypes: ["RT-Pln", "RT-Act", "RT-Sta", "RT-Evt", "RT-Not", "RT-Col"],
			changedAt: opts.fileDate
		});

		var hierarchyTypes = new Array(); // Benötigte Hierarchietypen werden definiert
		hierarchyTypes.push({
			id: "HT-BPMN-Prozessmodell",
			title: "SpecIF:Hierarchy",
			description: "Root node of a process model (outline).",
			changedAt: opts.fileDate
		});

		var resources = new Array(); // Resourcen und Statements werden eingebunden
		var statements = new Array();

		for (i = 0; i < elements.length; i++) {
			if (elements[i].hasOwnProperty("resourceType") == true) {
				resources.push(elements[i]);
			}
			if (elements[i].hasOwnProperty("statementType") == true) {
				statements.push(elements[i]);
			}
		}

		var hierarchies = new Array(); // Hierarchiebeziehungen werden eingebunden

		resources = resources.concat([{ // Folder werden angelegt
			id: "Folder1",
			resourceType: "RT-Fld",
			title: "Modell-Elemente (Glossar)",
			properties: [{
				propertyType: "PT-Fld-Name",
				value: "Modell-Elemente (Glossar)"
			}],
			changedAt: opts.fileDate
		}, {
			id: "Folder1.1",
			resourceType: "RT-Fld",
			title: "Akteure",
			properties: [{
				propertyType: "PT-Fld-Name",
				value: "Akteure"
			}],
			changedAt: opts.fileDate
		}, {
			id: "Folder1.2",
			resourceType: "RT-Fld",
			title: "Zustände",
			properties: [{
				propertyType: "PT-Fld-Name",
				value: "Zustände"
			}],
			changedAt: opts.fileDate
		}, {
			id: "Folder1.3",
			resourceType: "RT-Fld",
			title: "Ereignisse",
			properties: [{
				propertyType: "PT-Fld-Name",
				value: "Ereignisse"
			}],
			changedAt: opts.fileDate
		}]);

		nodeList = new Array;
		nodeList.push({
			id: "N-Diagram",
			resource: resources[0].id,
			changedAt: opts.fileDate
		})
		nodeList.push({
			id: "N-Folder1",
			resource: "Folder1",
			nodes: [],
			changedAt: opts.fileDate
		});
		nodeList[1].nodes.push({
			id: "N-Folder1.1",
			resource: "Folder1.1",
			nodes: [],
			changedAt: opts.fileDate
		});
		nodeList[1].nodes.push({
			id: "N-Folder1.2",
			resource: "Folder1.2",
			nodes: [],
			changedAt: opts.fileDate
		});
		nodeList[1].nodes.push({
			id: "N-Folder1.3",
			resource: "Folder1.3",
			nodes: [],
			changedAt: opts.fileDate
		});

		for (i = 0; i < resources.length; i++) { // Folder werden mit Akteuren, Zuständen und Ereignisen gefüllt
			if (resources[i].resourceType == "RT-Act") {
				nodeList[1].nodes[0].nodes.push({
					id: "N-" + resources[i].id,
					resource: resources[i].id,
					changedAt: opts.fileDate
				})
			}
			if (resources[i].resourceType == "RT-Sta") {
				nodeList[1].nodes[1].nodes.push({
					id: "N-" + resources[i].id,
					resource: resources[i].id,
					changedAt: opts.fileDate
				})
			}
			if (resources[i].resourceType == "RT-Evt") {
				nodeList[1].nodes[2].nodes.push({
					id: "N-" + resources[i].id,
					resource: resources[i].id,
					changedAt: opts.fileDate
				})
			}
		}

		hierarchies.push({
			id: "outline",
			title: model.title,
			hierarchyType: "HT-BPMN-Prozessmodell",
			nodes: nodeList,
			changedAt: opts.fileDate
		});

		// Verbinden der einzelnen SpecIF-Bestandteile mit dem Hauptknoten
		model.dataTypes = dataTypes;
		model.resourceTypes = resourceTypes;
		model.statementTypes = statementTypes;
		model.hierarchyTypes = hierarchyTypes;
		model.resources = resources;
		model.statements = statements;
		model.hierarchies = hierarchies;

		var myJSON = JSON.stringify(model);
		var myBeautyJSON = JSON.stringify(model, null, "\t");
		document.getElementById("output").innerHTML = document.getElementById("output").innerHTML + myBeautyJSON;;
		zipCreator(myJSON, opts.svgFile, opts.title)
	}

	// Lokales Speichern der .specifz Datei
	function zipCreator(json, svg, title) {
		var zip = new JSZip();
		zip.file("BPMN.specif", json);
		zip.file("BusinessProcess.svg", svg);
		zip.generateAsync({
				type: "blob"
			})
			.then(function(blob) {
				saveAs(blob, title + ".specifz");
			});
	}
}
