// Stores the data and settings
// Returns information about the data and settings.
Flox.Model = function() {
	
	"use strict";
	
		// Points and flows
	var nodes = [],
		flows = [],
	
		// Layout Settings
		maxFlowPoints = 20,
		distanceWeightExponent = 3,
		peripheralStiffnessFactor = 0.1,
		maxFlowLengthSpringConstant = 0.05,
		minFlowLengthSpringConstant = 0.5,
		enforceRangebox = true,
		flowRangeboxHeight = 0.3,
		antiTorsionWeight = 0.8,
		angularDistributionWeight = 0.5,
		nodeWeight = 0.0,
		nodeTolerancePx = 5,
		moveFlowsIntersectingNodes = true,
		multipleIterations = true,
		NBR_ITERATIONS = 100,
		showForceAnimation = false,
		FLOW_DISTANCE_THRESHOLD = 0.00000001, // TODO what should this be??
		checkFlowBoundingBoxes = true,
		maxFlows = 50,
		useNetFlows = false,
		mapScale = 0.5,
		
		// Map Appearance Settings
		maxFlowWidth = 30,
		maxNodeRadius = 5,
		isShowLockedFlows = true,
		flowDistanceFromStartPointPixel = 5,
		flowDistanceFromEndPointPixel = 5,
		NODE_STROKE_WIDTH = 0.5,
		
		// arrow settings
		// TODO Add arrowstuff to settings export and Flox.initGUI
		arrowSizeRatio = 0.1,
		arrowLengthRatio = 0.2,
		arrowLengthScaleFactor = 1.6,
		arrowWidthScaleFactor = 0.8,
		arrowEdgeCtrlLength = 0.5,
		arrowEdgeCtrlWidth = 0.5,
		arrowCornerPosition = 0.0,
		pointArrowTowardsEndpoint = true,
		
		// cached values. Does the layouter need these? I think these are set
		minFlowValue,
		maxFlowValue,
		meanFlowValue,
		minFlowLength,
		maxFlowLength,
		minNodeValue,
		maxNodeValue,
		meanNodeValue,	
		
		// Draw Settings
		drawFlows = true,
		drawNodes = false,
		drawArrows = true,
		drawControlPoints = false,
		drawIntermediateFlowPoints = false,
		drawRangeboxes = false,
				
		datasetName = null,

		// A list of appropriate scales for different US states. 
		// FIXME this is problematic, and very hard-coded. There is probably
		// a way to handle this more responsively. 
		// Not really a setting. Doesn't get passed in to the layoutWorker. 
		// TODO The layouter might care about the scale in order to help
		// determine an appropriate distance flows should be moved off nodes. 
		stateScales = {
			"wv" : 0.5
		},
		
		// Public object		
		my = {};
    
	    // Stores all flows and points/
	    // TODO All the code in FloxGraph could be moved into Model, since Model
	    // is the only one who uses it.
		// graph = Flox.getNewFlowGraph();


// START STUFF FROM GRAPH ============================

	// This updates and returns the min/max flow length in the model.
	// Needed because flow lengths change on zoom and during drag events,
	// while other cached values do not.
    // returns {min: value, max: value}
    function getMinMaxFlowLength() {
		    
		var i, j, flow, l;

		minFlowLength = Infinity;
		maxFlowLength = 0;

		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
            l = flow.getBaselineLength();
            if (l > maxFlowLength) {
                maxFlowLength = l;
            }
            if (l < minFlowLength) {
                minFlowLength = l;
            }
		}
		return {min: minFlowLength, max: maxFlowLength};
    }

	
	// Updates the cached values using only the filtered flows. These values
	// are used for drawing and layouts, which only care about the flows being
	// shown.
	function updateCachedValues() {
		
		if (flows.length < 1) {
			minFlowValue = 0;
			maxFlowValue = 0;
		} else {
			minFlowValue = maxFlowValue = flows[0].getValue();
		}

		var flowSum = 0,
		    flowCounter = 0,
		    nodeSum = 0,
			nodeCounter = 0,
			i, j, v, flow, l;
		    
		minFlowLength = Infinity;
		maxFlowLength = 0;

		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			v = flow.getValue();
			if (v < minFlowValue) {
			    minFlowValue = v;
			}
            if (v > maxFlowValue) {
                maxFlowValue = v;
            }
            flowSum += v;
            flowCounter += 1;
            l = flow.getBaselineLength();
            if (l > maxFlowLength) {
                maxFlowLength = l;
            }
            if (l < minFlowLength) {
                minFlowLength = l;
            }
		}
		
		meanFlowValue = flowSum / flowCounter;
			
		if(nodes.length < 1) {
			minNodeValue = 0;
		    maxNodeValue = 0;
		}

		if(nodes.length > 0) {
			minNodeValue = maxNodeValue = nodes[0].value;
		} else {
			minNodeValue = maxNodeValue = 0;
		}
		

		for (i = 0, j = nodes.length; i < j; i += 1) {
			
			v = nodes[i].value;
			
			if(!v) {
				nodes[i].value = 1;
				v = nodes[i].value;
			}
			
			if (v < minNodeValue) {
                minNodeValue = v;
            }
            if (v > maxNodeValue) {
                maxNodeValue = v;
            }
            nodeSum += v;
            nodeCounter += 1;
		}
		meanNodeValue = nodeSum / nodeCounter;
    }
    
    
    /**
     * If the target node exists in nodes already, return the existing node.
     * Otherwise, return the target node.
     */
    function findPoint(target) {

		var i, j, pt;
		// Loop through the existing nodes. If the coordinates match the current point, 
		// return the existing point.
		// If they don't match any of them, return the provided point.
		for (i = 0, j = nodes.length; i < j; i += 1) {
			pt = nodes[i];
			if (pt.lat === target.lat && pt.lng === target.lng) {
				return [true,pt];
			}
		}
		return [false,target];
	}
    
    /**
     * 
     */
    function addPoint(pt) {
		var xy, foundPt;
		
		// Add xy coords if pt doesn't have them
		if(!pt.x || !pt.y){
			xy = Flox.latLngToLayerPt([pt.lat, pt.lng]);
			pt.x = xy.x;
			pt.y = xy.y;
		}
		// Make sure it isn't a duplicate point
		foundPt = findPoint(pt);
		// Add the point to the _points array
		if(foundPt[0]===false) {
			nodes.push(foundPt[1]);
		}
		updateCachedValues();
    }
    
    // FIXME this is usually sorting a lot of flows. It needs to not block 
    // the UI! There are ways of doing this. Maybe pass to worker. 
    /**
     * Sort flows by value in descending order, unless ascending === true.
     */
    function sortFlows(ascending) {
		
		console.log("sorting flows...");
		var i;
		
		if(ascending === true) {
			flows.sort(function(a,b) {
				return a.getValue() - b.getValue();
			});
		} else {
			flows.sort(function(a,b) {
				return b.getValue() - a.getValue();
			});
		}
		console.log("done sorting flows");
    }
    
    
	/**
	 * Finds opposing flow in the model if there is one.
	 * Assigns it as a property of flow, and assigns flow as a property
	 * off the opposing flow.
	 * TODO Assumes there could only be one opposing flow in the model.
	 * Also, this might be dumb and bad. 
	 */
	function assignOppositeFlow(flow) {
		var candidates, i, j;
		
		// Make sure this flow doesn't already have an opposingFlow.
		if(!flow.hasOwnProperty("oppositeFlow")) {
			// Look at the outgoing flows of the endpoint.
			candidates = flow.getEndPt().outgoingFlows;
			
			for(i = 0, j = candidates.length; i < j; i += 1) {
				// Make sure candidate doesn't already have an opposing flow
				if(!candidates[i].hasOwnProperty("opposingFlow")) {
					// If the end point of candidate is same as start point
					// of flow
					if((candidates[i].getEndPt()) === (flow.getStartPt())) {
						// this candidate is an opposing flow.
						flow.oppositeFlow = candidates[i];
						candidates[i].oppositeFlow = flow;
					}
				}
			}
		}
    }
    
	function addFlow(flow){
		// Check to see if the points exist already.
		var startPoint = findPoint(flow.getStartPt())[1],
			endPoint = findPoint(flow.getEndPt())[1];
		// If they do, have the flows refer to THOSE instead of their duplicates.
		addPoint(startPoint);
        addPoint(endPoint);
		flow.setStartPt(startPoint);
		flow.setEndPt(endPoint);
        flows.push(flow);
        
        // If the start and end points don't have incomingFlows and 
		// outgoingFlows as properties, add them here. 
		// TODO repeated again in addFlows
		if(!startPoint.hasOwnProperty("outgoingFlows")) {
			startPoint.outgoingFlows = [];
		}
		if(!startPoint.hasOwnProperty("incomingFlows")) {
			startPoint.incomingFlows = [];
		}
		if(!endPoint.hasOwnProperty("outgoingFlows")) {
			endPoint.outgoingFlows = [];
		}
		if(!endPoint.hasOwnProperty("incomingFlows")) {
			endPoint.incomingFlows = [];
		}
        startPoint.outgoingFlows.push(flow);
        endPoint.incomingFlows.push(flow);
        
        updateCachedValues();
    }
    
    
    
	// Add multiple flows to the existing flows.
	function addFlows (newFlows) {
		var startPoint,
			endPoint,
			flow,
			i, j;
			
		for( i= 0, j = newFlows.length; i < j; i += 1) {
			flow = newFlows[i];
			startPoint = findPoint(flow.getStartPt())[1];
			endPoint = findPoint(flow.getEndPt())[1];
			addPoint(startPoint); // startPoint is assigned xy coords here.
	        addPoint(endPoint); // endPoint is assigned xy coords here.
			flow.setStartPt(startPoint);
			flow.setEndPt(endPoint);
	        flows.push(flow);
	        
			// If the start and end points don't have incomingFlows and 
			// outgoingFlows as properties, add them here. 
			if(!startPoint.hasOwnProperty("outgoingFlows")) {
				startPoint.outgoingFlows = [];
			}
			if(!startPoint.hasOwnProperty("incomingFlows")) {
				startPoint.incomingFlows = [];
			}
			if(!endPoint.hasOwnProperty("outgoingFlows")) {
				endPoint.outgoingFlows = [];
			}
			if(!endPoint.hasOwnProperty("incomingFlows")) {
				endPoint.incomingFlows = [];
			}
	        startPoint.outgoingFlows.push(flow);
	        endPoint.incomingFlows.push(flow);
	        assignOppositeFlow(flow);
		}
		sortFlows();
	    updateCachedValues();
    }
    
	function deletePoint(pt) {
		// delete flows that are connected to pt
		// First figure out which flows don't have pt in it
		var flowsNotContainingPt = [],
			i, j, index;
		for (i = 0, j = flows.length; i < j; i += 1) {
			if(flows[i].getStartPt()!==pt && flows[i].getEndPt()!==pt) {
				flowsNotContainingPt.push(flows[i]);
			}
		}
		
		// Set flows to the array of flows not containing pt. 
		flows = flowsNotContainingPt;
		
		// FIXME There is still more than one of each point sometimes.
		// TODO is there a polyfill for indexOf()?
		
		// Remove pt from the nodes array.
		index = nodes.indexOf(pt);
		if (index > -1) {
			nodes.splice(index, 1);
		}
		updateCachedValues();
	}


// END STUFF FROM GRAPH ============================

	/**
     * This value is called deCasteljauTol in java Flox. 
     * I don't know why I changed it. I should change it back.
     * Why do I keep doing this?
     * TODO
     */
    function getFlowPointGap() {
        // Get longest and shortest flow baseline lengths
        
        // FIXME this is all goofy, needs updated to worked with cashed values
        var flowLengthMinMax = getMinMaxFlowLength(),
			longestFlowLength = flowLengthMinMax.max,
			shortestFlowLength = flowLengthMinMax.min,
			tol = shortestFlowLength/(maxFlowPoints+1);

        // FIXME Not sure why this conditional statement is used. 
        // When would the first condition ever be true? 
        if (longestFlowLength / tol <= maxFlowPoints+1) {
            return tol;
        } 
        return longestFlowLength / (maxFlowPoints+1);
    }

	function getNodeRadius (node) {
		var nodeVal = node.value,
			maxNodeArea = Math.PI * (maxNodeRadius * maxNodeRadius),
			ratio, 
			area,
			radius;
			
		if (!maxNodeValue) { // There are not nodes yet
			ratio = maxNodeArea;
		} else {
			ratio = maxNodeArea / maxNodeValue;
		}
		
		// The area of node will be its value times the ratio
		area = Math.abs(nodeVal * ratio);
		
		// Need the radius to draw the point tho
		radius = Math.sqrt(area / Math.PI);
		return radius;
	}

	function getStartClipRadius(startNode) {
		var startNodeRadius = getNodeRadius(startNode) + (NODE_STROKE_WIDTH/2);
		return flowDistanceFromStartPointPixel + startNodeRadius;
			
	}

	function getEndClipRadius(endNode) {
		var endNodeRadius = getNodeRadius(endNode) + (NODE_STROKE_WIDTH/2);
		return flowDistanceFromEndPointPixel + endNodeRadius;
	}

	function getFlowStrokeWidth(flow) {
		var strokeWidth =  (maxFlowWidth * flow.getValue()) / maxFlowValue;
		    
		return strokeWidth;
	}


	// configure arrows for flows 
	function configureArrows() {
		var i, j, flow, flowWidth,	
			minFlowWidth = (maxFlowWidth * minFlowValue / maxFlowValue),
			endClipRadius, startClipRadius, endPt, startPt;
			
			//minFlowWidth = minFlowWidth > 1.5 ? minFlowWidth : 1.5;
			// FIXME again with the hard-coded minimum flow width. Stop doing this!
				
		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			flowWidth = getFlowStrokeWidth(flow);	
			
			endPt = flow.getEndPt();
			startPt = flow.getStartPt();
			
			if(endPt.necklaceMapNode) {
				endClipRadius = endPt.r + endPt.strokeWidth;
			} else {
				endClipRadius = getEndClipRadius(endPt);	
			}
			
			if(startPt.necklaceMapNode) {
				startClipRadius = startPt.r + startPt.strokeWidth;
			} else {
				startClipRadius = getStartClipRadius(startPt);	
			}
			
			flow.configureArrow(endClipRadius, minFlowWidth, maxFlowWidth, flowWidth,
				arrowSizeRatio, arrowLengthRatio, arrowLengthScaleFactor,
				arrowWidthScaleFactor, arrowCornerPosition, pointArrowTowardsEndpoint,
				arrowEdgeCtrlLength, arrowEdgeCtrlWidth);	
		}
	}

	function deselectAllFeatures() {
		var i, j, flow, node;
		
		for (i = 0, j = flows.length; i < j; i += 1) {
			flows[i].setSelected(false);
		}
		for (i = 0, j = nodes.length; i < j; i += 1) {
			nodes[i].selected = false;
		}
		Flox.updateTextBoxes();
	}

	/**
	 * @param {Object} settings key: value pairs of Model parameters.
	 */
	 function updateSettings(settings) {
		
		// Layout Settings
		maxFlowPoints = settings.maxFlowPoints;
		distanceWeightExponent = settings.distanceWeightExponent;
		peripheralStiffnessFactor = settings.peripheralStiffnessFactor;
		maxFlowLengthSpringConstant = settings.maxFlowLengthSpringConstant;
		minFlowLengthSpringConstant = settings.minFlowLengthSpringConstant;
		enforceRangebox = settings.enforceRangebox;
		flowRangeboxHeight = settings.flowRangeboxHeight;
		antiTorsionWeight = settings.antiTorsionWeight;
		angularDistributionWeight = settings.angularDistributionWeight;
		nodeWeight = settings.nodeWeight;
		nodeTolerancePx = settings.nodeTolerancePx;
		moveFlowsIntersectingNodes = settings.moveFlowsIntersectingNodes;
		multipleIterations = settings.multipleIterations;
		NBR_ITERATIONS = settings.NBR_ITERATIONS;
		showForceAnimation = settings.showForceAnimation;
		FLOW_DISTANCE_THRESHOLD = settings.FLOW_DISTANCE_THRESHOLD;
		checkFlowBoundingBoxes = settings.checkFlowBoundingBoxes;
		maxFlows = settings.maxFlows;
		mapScale = settings.mapScale;
		
		// Map Appearance Settings
		maxFlowWidth = settings.maxFlowWidth;
		maxNodeRadius = settings.maxNodeRadius;
		isShowLockedFlows = settings.isShowLockedFlows;
		flowDistanceFromStartPointPixel = settings.flowDistanceFromStartPointPixel;
		flowDistanceFromEndPointPixel = settings.flowDistanceFromEndPointPixel;
		NODE_STROKE_WIDTH = settings.NODE_STROKE_WIDTH;
		datasetName = settings.datasetName;
	}
	
	

// PUBLIC ======================================================================
	
	
	my.getNodeRadius = function (node) {
		return getNodeRadius(node);
	};
	
	my.getFlowStrokeWidth = function(flow) {
		return getFlowStrokeWidth(flow);
	};
	
	/**
	 * Cashe line segments of filtered flows.
	 */
	my.cacheAllFlowLineSegments = function () {
		var gap = getFlowPointGap(),
			flow,
			rs, re,
			i, j;
		
        for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			rs = flowDistanceFromStartPointPixel > 0 ? getStartClipRadius(flow.getStartPt()) : 0;
			re = flowDistanceFromEndPointPixel > 0 ? getEndClipRadius(flow.getEndPt()) : 0;
			flow.cacheClippedLineSegments(rs, re, gap);
        }
	};


	// FIXME only cashes maxFlows bounding boxes
	my.cacheAllFlowBoundingBoxes = function() {
		// console.log("caching flow bounding boxes!");
		var flow, i, j;
		for(i = 0, j = flows.length; i < j; i += 1) {
			flows[i].cacheBoundingBox();
		}
	};

	my.toJSON = function(){
		
		var JSON = {
				flows: []
		    },

			i, j, flow, node, sPt, ePt, cPt, val;
		
		JSON.settings = {
			maxFlowPoints : maxFlowPoints,
			distanceWeightExponent : distanceWeightExponent,
			peripheralStiffnessFactor : peripheralStiffnessFactor,
			maxFlowLengthSpringConstant : maxFlowLengthSpringConstant,
			minFlowLengthSpringConstant : minFlowLengthSpringConstant,
			enforceRangebox : enforceRangebox,
			flowRangeboxHeight : flowRangeboxHeight,
			maxFlowWidth : maxFlowWidth,
			maxNodeRadius : maxNodeRadius,
			antiTorsionWeight : antiTorsionWeight,
			angularDistributionWeight : angularDistributionWeight,
			nodeWeight : nodeWeight,
			nodeTolerancePx : nodeTolerancePx,
			moveFlowsIntersectingNodes : moveFlowsIntersectingNodes,
			multipleIterations : multipleIterations,
			isShowLockedFlows : isShowLockedFlows,
			NODE_STROKE_WIDTH : NODE_STROKE_WIDTH,
			NBR_ITERATIONS: NBR_ITERATIONS,
			showForceAnimation: showForceAnimation,
			FLOW_DISTANCE_THRESHOLD : FLOW_DISTANCE_THRESHOLD,
			flowDistanceFromStartPointPixel : flowDistanceFromStartPointPixel,
			flowDistanceFromEndPointPixel : flowDistanceFromEndPointPixel,
			checkFlowBoundingBoxes: checkFlowBoundingBoxes,
			maxFlows : maxFlows,
			mapScale: mapScale,
			datasetName: datasetName
		};
		
		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			sPt = flow.getStartPt();
			ePt = flow.getEndPt();
			cPt = flow.getCtrlPt();
			
			JSON.flows.push(
				{
					startPt: 
						{
							x: sPt.x,
							y: sPt.y,
							value: sPt.value,
							lat: sPt.lat,
							lng: sPt.lng,
							id: sPt.id,
							STUSPS: sPt.STUSPS,
							name: sPt.name
						},
					endPt: 
						{
							x: ePt.x, 
							y: ePt.y,
							value: ePt.value,
							lat: ePt.lat,
							lng: ePt.lng,
							id: ePt.id,
							STUSPS: ePt.STUSPS,
							name: ePt.name
						},
					cPt:
						{
							x: cPt.x,
							y: cPt.y
						},
					value: flow.getValue()
				}
			);
		}
		
		// Add the nodes to the json. Commented out because, so far, there
		// is no use for these. The node info is in the flows. 
		// for (i = 0, j = nodes.length; i < j; i += 1) {
			// node = nodes[i];
			// JSON.nodes.push(
				// {
					// x: node.x,
					// y: node.y,
					// value: node.value
				// }
			// );
		// }
		return JSON;
	};

	// Convert the nodes into json readable by the editableTable.js library
	/**
	 * @param editable Boolean determining whether the table is editable.
	 */
	my.getNodeTable = function (editable) {
		var data = [],
			metadata = [],
			i, j, node;
			
		metadata.push({ 
			name: "id", 
			label: "ID", 
			datatype: "string", 
			editable: false});
		metadata.push({ 
			name: "lat", 
			label: "LAT", 
			datatype: "double", 
			editable: true});
		metadata.push({ 
			name: "lng", 
			label: "LNG", 
			datatype: "double", 
			editable: true});
		metadata.push({ 
			name: "value", 
			label: "VALUE", 
			datatype: "double", 
			decimal_point: '.',
			thousands_separator: ',',
			editable: true});
		metadata.push({ 
			name: "action", 
			label: " ", 
			datatype: "html", 
			editable: false});
			
			
		for (i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];
			if(!node.id) {
				node.id = i;
			}
			data.push({
				id: node.id,
				values: {
					"id": node.id,
					"lat": node.lat,
					"lng": node.lng,
					"value": node.value
				}
			});
		}
		return {"metadata": metadata, "data": data};
	};

	my.getFlowTable = function () {
		var data = [],
			metadata = [],
			i, j, flow;
			
		metadata.push({ 
			name: "id", 
			label: "ID", 
			datatype: "string", 
			editable: false});
		metadata.push({ 
			name: "start", 
			label: "START", 
			datatype: "string", 
			editable: false});
		metadata.push({ 
			name: "end", 
			label: "END", 
			datatype: "string", 
			editable: false});
		metadata.push({ 
			name: "value", 
			label: "VALUE", 
			datatype: "double", 
			decimal_point: '.',
			thousands_separator: ',',
			editable: true});
		metadata.push({ 
			name: "action", 
			label: " ", 
			datatype: "html", 
			editable: false});
			
		for (i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			if(isNaN(flow.getId())) {
				flow.setId(i);
			}
			data.push({
				id: flow.getId(),
				values: {
					"id": flow.getId(),
					"start": flow.getStartPt().id,
					"end": flow.getEndPt().id,
					"value": flow.getValue()
				}
			});
		}
		
		
		return {"metadata": metadata, "data": data};
	};

	my.setNodeWeight = function (d) {
		nodeWeight = d;
	};

	my.getFlowDistanceFromEndPointPixel = function() {
		return flowDistanceFromEndPointPx;
	};
	
	my.getFlowDistanceFromStartPointPixel = function() {
		return flowDistanceFromStartPointPx;
	};

	my.getNodeStrokeWidth = function() {
		return NODE_STROKE_WIDTH;
	};
	
	my.getLocks = function() {
		var locks = [],
			i, j;
		for(i=0, j = flows.length; i < j; i += 1) {
			locks.push(flows[i].isLocked());
		}
		return locks;
	};
	
	my.applyLocks = function(locks) {
		var i, j;
		if(flows.length === locks.length) {
			for(i = 0, j = locks.length; i < j; i += 1) {
				flows[i].setLocked(locks[i]);
			}
		} else {
			console.log("Flows and locks have different lengths");
		}
	};
	
	my.isMultipleIterations = function() {
		return multipleIterations;
	};
	
	my.setMultipleIterations = function(boo) {
		multipleIterations = boo;
	};

	my.isMoveFlowsIntersectingNodes = function() {
		return moveFlowsIntersectingNodes;
	};

	my.setMoveFlowsIntersectingNodes = function(boo) {
		moveFlowsIntersectingNodes = boo;
	};

    my.getAngularDistributionWeight =  function() {
        return angularDistributionWeight;
    };

    
    my.getNbrFlows = function() {
       return flows.length;
    };

    my.getAntiTorsionWeight = function() {
        return antiTorsionWeight;
    };
    
    my.setAntiTorsionWeight = function(d) {
		antiTorsionWeight = d;
    };

    my.getMaxFlowWidth = function () {
        return maxFlowWidth;
    };

	my.getMaxNodeRadius = function() {
		return maxNodeRadius;
	};

	my.setMaxNodeRadius = function(d) {
		maxNodeRadius = d;
	};

    my.setMaxFlowWidth = function (maxWidth) {
        maxFlowWidth = maxWidth;
    };

    my.addPoint = function(pt) {
        addPoint(pt);
    };

	my.getAllNodes = function() {
		return nodes;
	};

    my.getPoints = function() {
        return nodes; 
    };

    my.addFlow = function(flow) {
        addFlow(flow);
    };

    // Add multiple flows 
    my.addFlows = function(newFlows) {
        addFlows(newFlows);
    };

    // return all flows
    my.getFlows = function() {
        return flows;
    };

	// Return all flows
	my.getAllFlows = function() {
		return flows;
	};

    // Get the control points of all filtered flows
    my.getCtrlPts = function() {
        var ctrlPts = [],
			i, j;
        for(i=0, j = flows.length; i < j; i += 1) {
            ctrlPts.push(flows[i].getCtrlPt());
        }
        return ctrlPts;
    };

    // Delete all flows from the model.
    my.deleteAllFlows = function() {
        flows = [];
        nodes = [];
        updateCachedValues();
    };

    my.getMaxFlowPoints = function() {
        return maxFlowPoints;
    };

    my.setMaxFlowPoints = function(d) {
        maxFlowPoints = d;
    };

    my.getDistanceWeightExponent = function() {
        return distanceWeightExponent;
    };

    my.setDistanceWeightExponent = function(d) {
        distanceWeightExponent = d;
    };

    my.setMaxFlowLengthSpringConstant = function(d) {
        maxFlowLengthSpringConstant = d;
    };

    my.setMinFlowLengthSpringConstant = function(d) {
        minFlowLengthSpringConstant = d;
    };

    my.setAngularDistributionWeight = function(d) {
        angularDistributionWeight = d;
    };

    my.setPeripheralStiffnessFactor = function(d) {
        peripheralStiffnessFactor = d;
    };

    my.getPeripheralStiffnessFactor = function() {
        return peripheralStiffnessFactor;
    };

    my.getMinFlowLengthSpringConstant = function() {
        return minFlowLengthSpringConstant;
    };

    my.getMaxFlowLengthSpringConstant = function() {
        return maxFlowLengthSpringConstant;
    };

    my.isEnforceRangebox = function() {
        return enforceRangebox;
    };

    my.setEnforceRangebox = function(bool) {
        enforceRangebox = bool;
    };

    my.getFlowRangeboxHeight = function() {
        return flowRangeboxHeight;
    };

    my.setFlowRangeboxHeight = function(val) {
        flowRangeboxHeight = val;
    };

	my.deletePoint = function(pt) {
		deletePoint(pt);
	};
	
	my.getNodeWeight = function() {
		return nodeWeight;
	};
	
	my.getNodeTolerancePx = function() {
		return nodeTolerancePx;
	};
	
	my.setNodeTolerancePx = function(d) {
		nodeTolerancePx = d;
	};
	
	my.getMinFlowValue = function() {
		return minFlowValue;
	};
	
	my.getMaxFlowValue = function() {
		return maxFlowValue;
	};
	
	my.getMeanFlowValue = function() {
		return meanFlowValue;
	};
	
	my.getMinFlowLength = function() {
		return minFlowLength;
	};
	
	my.getMaxFlowLength = function() {
		return maxFlowLength;
	};
	
	my.getMinNodeValue = function() {
		return minNodeValue;
	};
	
	my.getMaxNodeValue = function() {
		return maxNodeValue;
	};
	
	my.getMeanNodeValue = function() {
		return meanNodeValue;
	};
	
	my.isShowLockedFlows = function() {
		return isShowLockedFlows;
	};

	my.getMinMaxFlowLength = function() {
		return getMinMaxFlowLength();
	};

	my.getIterations = function () {
		return NBR_ITERATIONS;
	};

	my.updateCachedValues = function() {
		updateCachedValues();
	};

	my.isShowForceAnimation = function () {
		return showForceAnimation;
	};
	
	my.setShowForceAnimation = function (boo) {
		showForceAnimation = boo;
	};

	my.getFlowDistanceThreshold = function() {
		return FLOW_DISTANCE_THRESHOLD;
	};

	my.getFlowDistanceFromStartPointPixel = function() {
		return flowDistanceFromStartPointPixel;
	};
	
	my.setFlowDistanceFromStartPointPixel = function (d) {
		flowDistanceFromStartPointPixel = d;
	};

	my.getFlowDistanceFromEndPointPixel = function() {
		return flowDistanceFromEndPointPixel;
	};
	
	my.setFlowDistanceFromEndPointPixel = function (d) {
		flowDistanceFromEndPointPixel = d;
	};

	my.getStartClipRadius = function (startNode) {
	return getStartClipRadius(startNode);
	};
	
	my.getEndClipRadius = function (endNode) {
		return getEndClipRadius(endNode);
	};

	my.isDrawArrows = function () {
		return drawArrows;
	};

	my.setDrawArrows = function (boo) {
		drawArrows = boo;
	};

	my.configureArrows = function() {
		configureArrows();
	};

	my.getArrowSizeRatio = function() {
		return arrowSizeRatio;
	};
	
	my.setArrowSizeRatio = function(d) {
		arrowSizeRatio = d;
	};
	
	my.getArrowLengthRatio = function(d) {
		return arrowLengthRatio;
	};
	
	my.setArrowLengthRatio = function(d) {
		arrowLengthRatio = d;
	};
	
	my.getArrowLengthScaleFactor = function() {
		return arrowLengthScaleFactor;
	};
	
	my.setArrowLengthScaleFactor = function(d) {
		arrowLengthScaleFactor = d;
	};
	
	my.getArrowWidthScaleFactor = function() {
		return arrowWidthScaleFactor;
	};
	
	my.setArrowWidthScaleFactor = function(d) {
		arrowWidthScaleFactor = d;
	};
	
	my.getArrowEdgeCtrlLength = function() {
		return arrowEdgeCtrlLength;
	};
	
	my.setArrowEdgeCtrlLength = function(d) {
		arrowEdgeCtrlLength = d;
	};
	
	my.getArrowEdgeCtrlWidth = function() {
		return arrowEdgeCtrlWidth;
	};
	
	my.setArrowEdgeCtrlWidth = function (d) {
		arrowEdgeCtrlWidth = d;
	};
	
	my.getArrowCornerPosition = function() {
		return arrowCornerPosition;
	};

	my.setArrowCornerPosition = function(d) {
		arrowCornerPosition = d;
	};
	
	my.getPointArrowTowardsEndpoint = function() {
		return pointArrowTowardsEndpoint;
	};
	
	my.setPointArrowTowardsEndpoint = function(d) {
		pointArrowTowardsEndpoint = d;
	};

	my.getDrawSettings = function () {
		return {
			drawFlows : drawFlows,
			drawNodes : drawNodes,
			drawArrows : drawArrows,
			drawControlPoints : drawControlPoints,
			drawIntermediateFlowPoints : drawIntermediateFlowPoints,
			drawRangeboxes : drawRangeboxes
		};
	};
	
	my.isDrawFlows = function() {
		return drawFlows;
	};
	my.setDrawFlows = function(boo) {
		drawFlows = boo;
	};
	my.isDrawNodes = function() {
		return drawNodes;
	};
	my.setDrawNodes = function(boo) {
		drawNodes = boo;
	};
	my.isDrawArrows = function() {
		return drawArrows;
	};
	my.setDrawArrows = function(boo) {
		drawArrows = boo;
	};
	my.isDrawControlPoints = function() {
		return drawControlPoints;
	};
	my.setDrawControlPoints = function(boo) {
		drawControlPoints = boo;
	};
	my.isDrawIntermediateFlowPoints = function() {
		return drawIntermediateFlowPoints;
	};
	my.setDrawIntermediateFlowPoints = function(boo) {
		drawIntermediateFlowPoints = boo;
	};
	my.isDrawRangeboxes = function() {
		return drawRangeboxes;
	};
	my.setDrawRangeboxes = function(boo) {
		drawRangeboxes = boo;
	};


	my.deselectAllFeatures = function() {
		deselectAllFeatures();
	};

	my.setCheckFlowBoundingBoxes = function(boo) {
		checkFlowBoundingBoxes = boo;
	};

	my.isCheckFlowBoundingBoxes = function() {
		return checkFlowBoundingBoxes;
	};

	// Sort flows by value in descending order, unless otherwise specified.
	my.sortFlows = function (ascending) {
		sortFlows(ascending);
	};

	my.getMaxFlows = function () {
		return maxFlows;
	};
	
	my.setMaxFlows = function (d) {
		setMaxFlows(d);
	};

	my.getSelectedFlows = function () {
		var i, j, selectedFlows = [];
		
		for(i = 0, j = flows.length; i < j; i += 1) {
			if (flows[i].isSelected()) {
				selectedFlows.push(flows[i]); 
			}
		}
		return selectedFlows;
	};

	my.getSelectedNodes = function () {
		var i, j, selectedNodes = [];
		
		for(i = 0, j = nodes.length; i < j; i += 1) {
			if (nodes[i].selected) {
				selectedNodes.push(nodes[i]); 
			}
		}
		return selectedNodes;
	};
	
	my.getDrawSettings = function () {
		return {
			drawFlows: drawFlows,
			drawNodes: drawNodes,
			drawArrows: drawArrows,
			drawControlPoints: drawControlPoints,
			drawIntermediateFlowPoints: drawIntermediateFlowPoints,
			drawRangeboxes: drawRangeboxes
		};
	};
	
	my.getMapScale = function () {
		return mapScale;
	};
	
	my.setMapScale = function (d) {
		mapScale = d;
	};
	
	my.setStateMapScale = function(stateString) {
		mapScale = stateScales[stateString];
	};
	
	my.getStateMapScale = function(stateString) {
		return stateScales[stateString];
	};
	
	/**
	 * 
 * @param {Object} settings Key: value pairs of FloxModel parameters, 
 * e.g. maxFlowPoints: 20
	 */
	my.updateSettings = function(settings) {
		updateSettings(settings);
	};

	my.setDatasetName = function(nameString) {
		datasetName = nameString;
	};

	my.getDatasetName = function() {
		return datasetName;
	};

	/**
	 * Return the node with the matching id.
	 * Return null if no such node exists.
	 */
	my.findNodeByID = function(id) {
		
	};

	my.deserializeModelJSON = function(modelJSON) {
		// What did we pass this thing again?
		var flowData = modelJSON.flows,
			newFlows = [],
			flow, i, j, sPt, ePt, cPt;
	
		// Delete this models flows and nodes
		//my.deleteAllFlows();
	
		// Build flows out of flowData
		for(i = 0, j = flowData.length; i < j; i += 1) {
			sPt = flowData[i].startPt;
			ePt = flowData[i].endPt;
			cPt = flowData[i].cPt;
			flow = new Flox.Flow(sPt, ePt, flowData[i].value);
			flow.setCtrlPt(cPt);
			newFlows.push(flow);
		}
		addFlows(newFlows);
		updateSettings(modelJSON.settings);
	};
	
	return my;
};

















