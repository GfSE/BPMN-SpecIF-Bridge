/* 	Transform BPMN-XML to SpecIF
	Author: Robert Kanitz, adesso AG
	License: Apache 2.0
*/

// Durchlaufen der XML Datei und Überführen der Elemente in das SpecIF Format
function BPMN2Specif( xmlString, opts ) {
	"use strict";
	var parser = new DOMParser();
	var xmlDoc = parser.parseFromString(xmlString, "text/xml");
	var elements = new Array();
	var x,y,id;

	x = xmlDoc.querySelectorAll("collaboration");
	console.debug('x',x);
	elements.push( resourceFinder({
		typ: x[0].nodeName,  
		id: x[0].getAttribute("id"), 
		name: opts.fileName.split(".")[0] 
	}) );

	// Prozesse im Diagramm umwandeln:
	y = xmlDoc.querySelectorAll("process"); 
	x = x[0].childNodes;
	x.forEach( function(xe) {
		if (xe.nodeName.includes("participant")) {
			y.forEach( function(ye) {
				if ( ye.nodeName.includes("process")
					&& (xe.getAttribute("processRef") == ye.getAttribute("id")) ) {
						elements = elements.concat(analyzeProcess(ye, xe.getAttribute("id"), xe.getAttribute("name")))
				}
			})
		}
	});

	// Nachrichtenflüsse umwandeln:
	x.forEach( function(xe) { 
		if (xe.nodeName.includes("messageFlow")) {
			elements = elements.concat( statementFinder( elements, {
				typ: xe.nodeName, 
				id: xe.getAttribute("id"), 
				name: xe.getAttribute("name"), 
				source: xe.getAttribute("sourceRef"), 
				target: xe.getAttribute("targetRef")
			}) )
		}
	});

	// Beziehungen zwischen Diagramm und Elementen herstellen:
	id = 1;
	elements.forEach( function(el) { 
	//	if (el.resourceType == "RT-Act" || el.resourceType == "RT-Evt" || el.resourceType == "RT-Sta") {
		if( ["RT-Act","RT-Evt","RT-Sta"].indexOf(el.resourceType)>-1 ) {
			elements.push({
				id: "Diagram_shows_" + id,
				title: "SpecIF:shows",
				statementType: "ST-Visibility",
				subject: elements[0].id,
				object: el.id,
				changedAt: opts.fileDate
			});
			id++
		}
	});

//	var clonedArray = JSON.parse(JSON.stringify(elements));
	console.debug(elements);
	return modelBuilder( elements, opts );

// =======================================
// called functions:	
	function analyzeProcess(nodeList, participantId, name) {
		let x,i,id;
		let erg = new Array();

		if (name == "Hauptprozess") {
			return erg
		};
		erg.push( resourceFinder({
			typ: nodeList.nodeName, 
			id: participantId, 
			name: name, 
		//	source: null, 
		//	target: null, 
			stereotype: "participant"
		}) );

		// Erstellen aller Ressourcen und Platzhaltern für Gateways:
		x = nodeList.childNodes;
		x.forEach( function(xe) {
		//	if (xe.nodeName != "#text" && xe.nodeName != "bpmn:sequenceFlow" && xe.nodeName != "sequenceFlow" && xe.nodeName != "extensionElements" && xe.nodeName != "laneSet" && xe.nodeName != "documentation") {
			if( ["#text","bpmn:sequenceFlow","sequenceFlow","extensionElements","laneSet","documentation"].indexOf(xe.nodeName)<0 ) {	
				erg.push( resourceFinder({
					typ: xe.nodeName, 
					id: xe.getAttribute("id"), 
					name: xe.getAttribute("name"), 
					source: xe.getAttribute("sourceRef"), 
					target: xe.getAttribute("targetRef")
				//	stereotype
				}) )
			}
		});

		// Statements zwischen den Ressourcen und Platzhaltern für Gateways erstellen:
		x.forEach( function(xe) {
			if (xe.nodeName == "bpmn:sequenceFlow" || xe.nodeName == "sequenceFlow") {
				erg.push( statementFinder( erg, {
					typ: xe.nodeName, 
					id: xe.getAttribute("id"), 
					name: xe.getAttribute("name"), 
					source: xe.getAttribute("sourceRef"), 
					target: xe.getAttribute("targetRef")
				}) )
			}
		});

		// Gateways auflösen:
		transformGateways(erg);  

		// Beziehungen zwischen Prozess Elementen herstellen:
		id = 1;
		for (i = 1; i < erg.length; i++) { 
		//	if (erg[i].resourceType == "RT-Act" || erg[i].resourceType == "RT-Evt" || erg[i].resourceType == "RT-Sta") {
			if( ["RT-Act","RT-Evt","RT-Sta"].indexOf(erg[i].resourceType)>-1 ) {
				erg.push({
					id: erg[0].id + "_contains_" + id,
					title: "SpecIF:contains",
					statementType: "ST-Containment",
					subject: erg[0].id,
					object: erg[i].id,
					changedAt: opts.fileDate
				});
				id++
			}
		};
		return erg
	}

	// BPMN-Elemente (außer verbindende Objekte) in SpecIF Ressourcen übersetzen:
	function resourceFinder(params) {  // {typ, id, name, source, target, stereotype}
		// Anpassung für BPMN.io, da dort bpmn: im Tag verwendet wird
		if (params.typ.includes("bpmn:")) { 
			params.typ = params.typ.split(":")[1]
		};
		if (typeof(params.stereotype) == "undefined") {
			params.stereotype = params.typ
		};

		switch (params.typ) {
			case "collaboration":
				return {
					id: params.id,
					title: params.name,
					properties: [{
						title: "dcterms:title",
						propertyType: "PT-Pln-Name",
						value: params.name
					}, {
						title: "SpecIF:Diagram",
						propertyType: "PT-Pln-Diagram",
						value: "<div><p>Dies ist der geladene BPMN-Prozess" +
							" </p><p class=\"inline-label\">Model View:</p><div class=\"forImage\" style=\"max-width: 600px;\" > <object " +
							"data=\"BusinessProcess.svg\" type=\"image/svg+xml\" >BusinessProcess</object></div></div>"
					}, {
						title: "SpecIF:Notation",
						propertyType: "PT-Pln-Notation",
						value: "BPMN 2.0 Process Diagram"
					}],
					resourceType: "RT-Pln",
					changedAt: opts.fileDate
				};

			case "startEvent":
			case "intermediateThrowEvent":
			case "endEvent":
				return {
					id: params.id,
					title: params.name,
					properties: [{
						title: "dcterms:title",
						propertyType: "PT-Evt-Name",
						value: params.name
					}, {
						title: "SpecIF:Stereotype",
						propertyType: "PT-Evt-Stereotype",
						value: params.stereotype
					}],
					resourceType: "RT-Evt",
					changedAt: opts.fileDate
				};

			case "participant":
			case "process":
			case "task":
			case "userTask":
				return {
					id: params.id,
					title: params.name,
					properties: [{
						title: "dcterms:title",
						propertyType: "PT-Act-Name",
						value: params.name
					}, {
						title: "SpecIF:Stereotype",
						propertyType: "PT-Act-Stereotype",
						value: params.stereotype
					}],
					resourceType: "RT-Act",
					changedAt: opts.fileDate
				};

			case "dataObjectReference":
			case "dataStoreReference":
				return {
					id: params.id,
					title: params.name,
					properties: [{
						title: "dcterms:title",
						propertyType: "PT-Sta-Name",
						value: params.name
					}, {
						title: "SpecIF:Stereotype",
						propertyType: "PT-Sta-Stereotype",
						value: params.stereotype
					}],
					resourceType: "RT-Sta",
					changedAt: opts.fileDate
				};

			case "parallelGateway":
				return {
					id: params.id,
					title: params.name,
					incoming: [],
					outgoing: [],
					resourceType: "parallelGateway",
					changedAt: opts.fileDate
				};

			case "exclusiveGateway":
				return {
					id: params.id,
					title: params.name,
					incoming: [],
					outgoing: [],
					resourceType: "exklusiveGateway",
					changedAt: opts.fileDate
				};

			default:
				return "unknown element";
		}
	}

	// Nachrichten- oder Sequenzfluss in SpecIF-Elemente übersetzen:
	function statementFinder( elements, params ) {  // {typ, id, name, source, target}
		if (params.typ.includes("bpmn:")) { 
			params.typ = params.typ.split(":")[1]
		};
		var subject = elements.find(function(resource) {
			return resource.id == params.source
		});
		var object = elements.find(function(resource) {
			return resource.id == params.target
		});
		if( !subject || !object ) 
			return 'unknown model-element configuration';

		switch (params.typ) {  
			case "messageFlow":
				var erg = [];
				erg.push( resourceFinder({
					typ: "dataObjectReference", 
					id: params.id + "_1", 
					name: params.name, 
			//		source: null, 
			//		target: null, 
					stereotype: params.typ
				}) );
				erg.push({
					id: params.id + "_2",
					title: "SpecIF:writes",
					statementType: "ST-Writing",
					subject: subject.id,
					object: params.id + "_1",
					changedAt: opts.fileDate
				});
				erg.push({
					id: params.id + "_3",
					title: "SpecIF:reads",
					statementType: "ST-Reading",
					subject: object.id,
					object: params.id + "_1",
					changedAt: opts.fileDate
				});

				var statementCount, participant;
				statementCount = 0;
				if (subject.properties[1].value == "participant") { // Ist das Subjekt ein Pool bzw. Participant?
					elements.forEach( function(el) {
						if (el.title == "SpecIF:contains" && el.subject == subject.id) {
							statementCount++;
						}
					});
					erg.push({
						id: subject.id + "_contains_" + (statementCount + 1),
						title: "SpecIF:contains",
						statementType: "ST-Containment",
						subject: subject.id,
						object: params.id + "_1",
						changedAt: opts.fileDate
					})
				} else {
					elements.forEach( function(el) {
						if (el.title == "SpecIF:contains" && el.object == subject.id) {
							participant = elements.find(function(resource) {
								return resource.id == el.subject;
							})
						}
					});
					elements.forEach( function(el) {
						if (el.title == "SpecIF:contains" && el.subject == participant.id) {
							statementCount++
						}
					});
					erg.push({
						id: participant.id + "_contains_" + (statementCount + 1),
						title: "SpecIF:contains",
						statementType: "ST-Containment",
						subject: participant.id,
						object: params.id + "_1",
						changedAt: opts.fileDate
					})
				};
				statementCount = 0;
				if (object.properties[1].value == "participant") { // Ist das Objekt ein Pool bzw. Participant?
					elements.forEach( function(el) {
						if (el.title == "SpecIF:contains" && el.subject == object.id) {
							statementCount++
						}
					});
					erg.push({
						id: object.id + "_contains_" + (statementCount + 1),
						title: "SpecIF:contains",
						statementType: "ST-Containment",
						subject: object.id,
						object: params.id + "_1",
						changedAt: opts.fileDate
					})
				} else {
					// Schleife zum Finden des Teilnehmers bzw. Pools
					elements.forEach( function(el) { 
						if (el.title == "SpecIF:contains" && el.object == object.id) {
							participant = elements.find(function(resource) {
								return resource.id == el.subject
							})
						}
					});
					elements.forEach( function(el) {
						if (el.title == "SpecIF:contains" && el.subject == participant.id) {
							statementCount++
						}
					});
					erg.push({
						id: participant.id + "_contains_" + (statementCount + 1),
						title: "SpecIF:contains",
						statementType: "ST-Containment",
						subject: participant.id,
						object: params.id + "_1",
						changedAt: opts.fileDate
					})
				};
				return erg;

			case "sequenceFlow":
				console.debug('#',subject,object,params)
				if (subject.resourceType == "RT-Act" && object.resourceType == "RT-Act") {
					return {
						id: params.id,
						title: "SpecIF:precedes",
						statementType: "ST-Preceding",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					}
				};
				if ((subject.resourceType == "RT-Act" || subject.resourceType == "RT-Evt") && object.resourceType == "RT-Evt") {
					return {
						id: params.id,
						title: "SpecIF:signals",
						statementType: "ST-Signalling",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					}
				};
				if (subject.resourceType == "RT-Evt" && object.resourceType == "RT-Act") {
					return {
						id: params.id,
						title: "SpecIF:triggers",
						statementType: "ST-Triggering",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					}
				};
				if (subject.resourceType == "parallelGateway" || subject.resourceType == "exklusiveGateway") {
					subject.outgoing.push({
						id: params.id,
						title: params.name,
						statementType: "gatewayFlow",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					})
				};
				if (object.resourceType == "parallelGateway" || object.resourceType == "exklusiveGateway") {
					object.incoming.push({
						id: params.id,
						title: params.name,
						statementType: "gatewayFlow",
						subject: subject.id,
						object: object.id,
						changedAt: opts.fileDate
					})
				};

				return {
					id: params.id,
					title: params.name,
					statementType: "gatewayFlow",
					subject: subject.id,
					object: object.id,
					changedAt: opts.fileDate
				};

			default:
				return "unknown model-element"
		}
	}

	// Ressourcen und Statements aus den Gateways und ihren Sequenzflüssen herstellen
	// ! Funktioniert nicht bei direkt aufeinanderfolgenden Gateways !
	function transformGateways(elements) {
		elements.forEach( function(el) {
			// Paralleles Gateway ausgehend 1 -> x
			if (el.resourceType == "parallelGateway" && el.incoming.length == 1) { 
				el.outgoing.forEach( function(outg) {
					outg.subject = el.incoming[0].subject;
					elements.push( statementFinder(elements, {
						typ: "sequenceFlow", 
						id: outg.id, 
						name: "", 
						source: outg.subject, 
						target: outg.object
					}) )
				})
			};

			// Paralleles Gateway eingehend x -> 1
			if (el.resourceType == "parallelGateway" && el.outgoing.length == 1) { 
				elements.push( resourceFinder({
					typ: "task", 
					id: el.id, 
					name: "Warte auf vorherige Elemente", 
				//	source: null, 
				//	target: null, 
					stereotype: "parallelGateway"
				}) );
				el.id = null;
				elements.push( statementFinder( elements, {
					typ: "sequenceFlow", 
					id: el.outgoing[0].id, 
					name: "", 
					source: el.outgoing[0].subject, 
					target: el.outgoing[0].object
				}) );
				el.incoming.forEach( function(inco) {
					elements.push( statementFinder( elements, {
						typ: "sequenceFlow", 
						id: inco.id, 
						name: "", 
						source: inco.subject, 
						target: inco.object
					}) )
				})
			};

			// Exklusives Gateway ausgehend 1 -> x
			if (el.resourceType == "exklusiveGateway" && el.incoming.length == 1) { 
				for ( var j = 0; j < el.outgoing.length; j++) {
					elements.push( resourceFinder({
						typ: "intermediateThrowEvent", 
						id: el.id + "_" + j, 
						name: el.outgoing[j].title, 
					//	source: null, 
					//	target: null, 
						stereotype: "exklusiveGateway"
					}) );
					elements.push( statementFinder( elements, {
						typ: "sequenceFlow", 
						id: el.incoming[0].id + "_" + j, 
						name: "", 
						source: el.incoming[0].subject, 
						target: el.id + "_" + j
					}) );
					elements.push( statementFinder( elements, {
						typ: "sequenceFlow", 
						id: el.outgoing[j].id, 
						name: "", 
						source: el.id + "_" + j, 
						target: el.outgoing[j].object
					}) )
				}
			};

			// Exklusives Gateway eingehend x -> 1
			if (el.resourceType == "exklusiveGateway" && el.outgoing.length == 1) { 
				el.incoming.forEach( function(inco) {
					inco.object = el.outgoing[0].object;
					elements.push( statementFinder( elements, {
						typ: "sequenceFlow", 
						id: inco.id, 
						name: "", 
						source: inco.subject, 
						target: inco.object
					}) )
				})
			}
		});

		// Gateways entfernen:
		let i = 0;
		while ( i<elements.length ) {
			if (elements[i].statementType == "gatewayFlow" || elements[i].resourceType == "parallelGateway" || elements[i].resourceType == "exklusiveGateway") 
				elements.splice(i, 1)
			else
				i++
		}
	}

	// SpecIF Projekt im JSON Format bauen:
	function modelBuilder( elements, opts ) {
		var d = new Date();
		var model = new Object();	// process model in SpecIF/JSON format
		model.id = "BPMN-" + (d.getDate() + "" + d.getMonth() + "" + d.getFullYear() + "" + d.getHours() + "" + d.getMinutes() + "" + d.getSeconds());
		model.title = opts.title;
		model.description = opts.description;
		model.specifVersion = "0.10.3";

		// Benötigte Datentypen definieren
		var dataTypes = new Array(); 
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

		// Benötigte Ressourcentypen definieren:
		var resourceTypes = new Array(); 
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
		});
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
		});
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
		});
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
		});
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
		});
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
		});

		// Benötigte Statementtypen definieren:
		var statementTypes = new Array(); 
		statementTypes.push({
			id: "ST-Visibility",
			title: "SpecIF:shows",
			description: "Statement: Plan shows Model-Element",
			subjectTypes: ["RT-Pln"],
			objectTypes: ["RT-Act", "RT-Sta", "RT-Evt"],
			changedAt: opts.fileDate
		})
		statementTypes.push({
			id: "ST-Containment",
			title: "SpecIF:contains",
			description: "Statement: Model-Element contains Model-Element",
			subjectTypes: ["RT-Act", "RT-Sta", "RT-Evt"],
			objectTypes: ["RT-Act", "RT-Sta", "RT-Evt"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Storage",
			title: "SpecIF:stores",
			description: "Statement: Actor (Role, Function) writes and reads State (Information)",
			subjectTypes: ["RT-Act"],
			objectTypes: ["RT-Sta"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Writing",
			title: "SpecIF:writes",
			description: "Statement: Actor (Role, Function) writes State (Information)",
			subjectTypes: ["RT-Act"],
			objectTypes: ["RT-Sta"],
			changedAt: opts.fileDate
		});
		statementTypes.push({
			id: "ST-Reading",
			title: "SpecIF:reads",
			description: "Statement: Actor (Role, Function) reads State (Information)",
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

		// Benötigte Hierarchietypen definieren:
		var hierarchyTypes = new Array(); 
		hierarchyTypes.push({
			id: "HT-BPMN-Prozessmodell",
			title: "SpecIF:Hierarchy",
			description: "Root node of a process model (outline).",
			changedAt: opts.fileDate
		});

		// Resourcen und Statements einbinden:
		var resources = new Array(); 
		var statements = new Array();

		elements.forEach( function(el) {
			if (el.hasOwnProperty("resourceType")) {
				resources.push(el);
			}
			if (el.hasOwnProperty("statementType")) {
				statements.push(el);
			}
		});

		// Hierarchiebeziehungen einbinden:
		var hierarchies = new Array(); 

		// Folder anlegen:
		resources = resources.concat([{ 
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

		let nodeList = new Array;
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

		// Folder mit Akteuren, Zuständen und Ereignisen füllen:
		resources.forEach( function(r) { 
			if (r.resourceType == "RT-Act") {
				nodeList[1].nodes[0].nodes.push({
					id: "N-" + r.id,
					resource: r.id,
					changedAt: opts.fileDate
				})
			};
			if (r.resourceType == "RT-Sta") {
				nodeList[1].nodes[1].nodes.push({
					id: "N-" + r.id,
					resource: r.id,
					changedAt: opts.fileDate
				})
			};
			if (r.resourceType == "RT-Evt") {
				nodeList[1].nodes[2].nodes.push({
					id: "N-" + r.id,
					resource: r.id,
					changedAt: opts.fileDate
				})
			}
		});

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
		
		return model
	}
}
