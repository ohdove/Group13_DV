// --- 1. Setup Map Dimensions and Projections ---
const mapWidth = 800;
const mapHeight = 800;

let targetYear; // Will hold the currently selected year
let fullData = []; // To store all loaded data
let availableYears = []; // To store unique years from the data

// Initial Projection: 3D Orthographic (Globe View)
const initialScale = 400; 
const initialCenter = [130, -25]; // Coordinates (longitude, latitude) to center Australia
const initialRotate = [-initialCenter[0], -initialCenter[1], 0];

// The main orthographic projection for the globe view
let orthographicProjection = d3.geoOrthographic()
    .scale(initialScale)
    .center([0, 0])
    .rotate(initialRotate) 
    .translate([mapWidth / 2, mapHeight / 2]);

//A flat projection (Mercator) for the zoomed-in map view
let flatProjection = d3.geoMercator()
    .translate([mapWidth / 2, mapHeight / 2]);

// The path generator and current projection start with the orthographic projection
let projection = orthographicProjection;
let path = d3.geoPath().projection(projection);

// Create the main SVG container
const svg = d3.select("#mapChartContainer")
    .append("svg")
    .attr("width", mapWidth)
    .attr("height", mapHeight)
    .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`);

// Group element to hold map features
const g = svg.append("g");

// Tooltip setup
const tooltip = d3.select("body").append("div")
    .attr("class", "pie-tooltip")
    .style("opacity", 0)
    .style("position", "absolute");

// Global state and data variables
let currentView = 'world'; 
let worldGeoJson, ausStatesGeoJson, dataMap;
let ausFeature;

// Define color scale and jurisdiction map
const colorScale = d3.scaleQuantize().range(d3.schemeBlues[7]);

// Full Name -> Short Form Map (for tooltip display)
const SHORT_FORM_MAP = {
    "Australian Capital Territory": "ACT",
    "New South Wales": "NSW",
    "Northern Territory": "NT",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Tasmania": "TAS",
    "Victoria": "VIC",
    "Western Australia": "WA",
};

// Short Form
const JURISDICTION_MAP = {
    "ACT": "Australian Capital Territory",
    "NSW": "New South Wales",
    "NT": "Northern Territory",
    "QLD": "Queensland",
    "SA": "South Australia",
    "TAS": "Tasmania",
    "VIC": "Victoria",
    "WA": "Western Australia",
};

// --- 2. Data Processing Function ---
function transformData(data, year) {
    const filteredData = data.filter(d => d.YEAR === year); 
    
    const dataMap = new Map();
    filteredData.forEach(d => {
        const fullName = JURISDICTION_MAP[d.JURISDICTION.toUpperCase()];
        if (fullName) {
            dataMap.set(fullName, +d.Total_Positive_Count);
        }
    });
    
    // Update color scale domain based on the filtered data
    const choroplethValues = Array.from(dataMap.values());
    if (choroplethValues.length > 0) {
        colorScale.domain([d3.min(choroplethValues), d3.max(choroplethValues)]);
    } else {
        colorScale.domain([0, 100]); // Default domain if no data
    }
    return dataMap;
}

// Helper function to attach mouse events
function attachMouseEvents(selection) {
    selection
        .on("mouseover", (event, d) => {
            const stateName = d.properties.STATE_NAME || d.properties.name;
            const shortForm = SHORT_FORM_MAP[stateName] ? ` (${SHORT_FORM_MAP[stateName]})` : '';
            const value = dataMap.get(stateName); 
            
            tooltip.style("opacity", 1)
                // Include shortForm in the tooltip HTML
                .html(`<strong>${stateName}${shortForm}</strong><br>Positive Count (${targetYear}): ${value !== undefined ? d3.format(",.1f")(value) : 'N/A'}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
            const hoverStroke = stateName === "Australian Capital Territory" ? 5 : 2;
            d3.select(event.currentTarget).attr("stroke-width", hoverStroke).attr("stroke", "black");
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", (event, d) => { 
            tooltip.style("opacity", 0);
            
            const stateName = d.properties.STATE_NAME || d.properties.name;
            const defaultStroke = stateName === "Australian Capital Territory" ? 5 : 1.5;

            d3.select(event.currentTarget).attr("stroke-width", defaultStroke).attr("stroke", "#ffffff");
        })
        .on("click", resetToWorld); // Click resets to world map
}

// --- Australian Choropleth Drawing Function ---
function drawAusChoropleth() {
    
    // Remove old states if they exist
    g.selectAll("path.state").remove();

    // 1. Draw the Australian states as an overlay
    const states = g.selectAll("path.state")
        .data(ausStatesGeoJson.features) // Accesses global ausStatesGeoJson
        .join("path")
        .attr("class", "state")
        .attr("d", path) // Use the current path (orthographic projection)
        .attr("fill", d => {
            const stateName = d.properties.STATE_NAME || d.properties.name; 
            const value = dataMap.get(stateName); // Accesses global dataMap
            return value !== undefined ? colorScale(value) : "#ccc"; 
        })
        .attr("stroke", "#ffffff")
        .attr("stroke-width", d => {
            const stateName = d.properties.STATE_NAME || d.properties.name;
            return stateName === "Australian Capital Territory" ? 5 : 1.5;
        })
        .style("cursor", "pointer");
        
    // Attach mouse events to states
    attachMouseEvents(states);
        
    // Apply a fade-in transition (using the selection object)
    states.style("opacity", 0) 
        .transition().duration(500)
        .style("opacity", 1);
}

function updateYearText() {
    d3.select("#map-current-year").text(targetYear);
}

// --- Dynamic Filter Creation ---
function createYearFilter() {
    const select = d3.select("#map-year-filter");
    
    // Sort years descending, so the latest is first
    const sortedYears = availableYears.sort(d3.descending); 

    select.selectAll("option")
        .data(sortedYears)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

    // Set the initial value to the latest year and update the targetYear variable
    targetYear = sortedYears[0];
    select.property("value", targetYear);
    updateYearText();

    // Attach event listener
    select.on("change", function() {
        targetYear = +this.value; // Update the global variable

        updateYearText(); 
        updateMap(); // Call the update function
    });
}

// --- Function to update the map when the year changes ---
function updateMap() {
    // 1. Re-process data for the new targetYear
    dataMap = transformData(fullData, targetYear);
    
    // 2. If zoomed in, re-draw the choropleth
    if (currentView === 'aus') {
        drawAusChoropleth();
    }
    
    console.log(`Map data updated for year: ${targetYear}`);
}

// --- Helper Functions ---
function moveContainerDown() {
    d3.select("#mapChartContainer")
        .classed("zoomed", true);
}

function moveContainerUp() {
    d3.select("#mapChartContainer")
        .classed("zoomed", false);
}

// --- Zoom and Reset Functions (filter visibility) ---
function zoomToAustralia(feature) {
    if (currentView !== 'world') return;
    currentView = 'aus';

    moveContainerDown();

    // 1. Get Centroid (for rotation)
    const centroid = d3.geoCentroid(feature);
    
    // 2. Define a scale for the transition that brings Australia to focus
    const finalScale = 1150; 
    
    // 3. Perform Transition (3D and zoom)
    g.transition()
        .duration(1500)
        .tween("rotate", function() {
            // Interpolate rotation (to center Australia)
            const r = d3.interpolate(projection.rotate(), [-centroid[0], -centroid[1], 0]);
            // Interpolate scale (to zoom in)
            const s = d3.interpolate(projection.scale(), finalScale); 

            return function(t) {
                // Ensure the path generator uses the orthographic projection during the transition
                projection = orthographicProjection;
                path.projection(projection);

                projection.rotate(r(t)).scale(s(t));
                g.selectAll("path").attr("d", path);
                // Fade out non-Australia countries slightly but keep them visible
                g.selectAll("path:not(.clickable-aus)").style("opacity", 0.3); 
                g.select(".sphere").attr("d", path); // Update sphere on every tick
            };
        })
        .on("end", function() {
            // Draw Australian states overlay on top of the world map
            drawAusChoropleth();
            // Show the year filter control after zoom is complete
            d3.select("#map-controls").style("display", "flex");
        });
}

function resetToWorld() {
    if (currentView !== 'aus') return;
    currentView = 'world'; 

    // Hide the year filter control immediately when resetting
    d3.select("#map-controls").style("display", "none");

    moveContainerUp();

    // Hide the tooltip immediately when resetting the map
    tooltip.style("opacity", 0);

    g.selectAll("path.state")
        .on("mouseover", null)
        .on("mousemove", null)
        .on("mouseout", null)
        .on("click", null);

    // 1. Fade out the Choropleth 
    g.selectAll("path.state").transition().duration(500).style("opacity", 0).remove();

    // 2. Reset world map opacity and transition back to original view
    g.selectAll("path.world").transition().duration(500).style("opacity", 1);
    g.select(".sphere").style("fill", "#AAD3FF"); // Restore water color

    // 3. Zoom out Transition (back to original globe view)
    g.transition()
        .duration(1500)
        .tween("rotate", function() {
            // Interpolate rotation and scale back to initial values
            const r = d3.interpolate(orthographicProjection.rotate(), initialRotate);
            const s = d3.interpolate(orthographicProjection.scale(), initialScale);
            
            return function(t) {
                // Ensure the path generator uses the orthographic projection for the zoom-out
                projection = orthographicProjection;
                path.projection(projection);
                
                projection.rotate(r(t)).scale(s(t));
                g.selectAll("path").attr("d", path); // Redraw all paths
            };
        });
}

// --- 3. Drawing and Interaction Functions ---
async function drawMap() {
    // A. Load GeoJSON for world map 
    worldGeoJson = await d3.json("data/world.geojson.json");

    // B. Load GeoJSON for Australian states/territories
    ausStatesGeoJson = await d3.json("data/australia.geojson.json"); 
    
    // C. Load ALL Choropleth Data
    fullData = await d3.csv("data/Map_TotalPositiveTestCount_byArea.csv", d => ({
        YEAR: +d.YEAR,
        JURISDICTION: d.JURISDICTION,
        Total_Positive_Count: +d.Total_Positive_Count
    }));
    
    // Get unique available years
    availableYears = Array.from(new Set(fullData.map(d => d.YEAR))).sort(d3.descending);
    
    // Create the Year Filter and set the initial targetYear
    createYearFilter();
    
    // Process initial data (uses the latest year set by createYearFilter)
    dataMap = transformData(fullData, targetYear);
    
    // Find the feature for Australia in the world map
    ausFeature = worldGeoJson.features.find(f => f.properties.name === "Australia");

    // D. Draw the Globe Sphere (Water)
    g.append("path")
      .datum({type: "Sphere"})
      .attr("class", "sphere")
      .attr("d", path)
      .attr("fill", "#AAD3FF");

    // E. Draw the World Map Features (Countries)
    g.selectAll("path.world")
        .data(worldGeoJson.features)
        .join("path")
        .attr("class", d => `world ${d.properties.name === "Australia" ? 'clickable-aus' : ''}`)
        .attr("d", path)
        .attr("fill", d => d.properties.name === "Australia" ? "#2a5d9f" : "#C0C0C0")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.5)
        .style("cursor", d => d.properties.name === "Australia" ? "pointer" : "default")
        .on("click", (event, d) => {
            if (d.properties.name === "Australia" && currentView === 'world') {
                zoomToAustralia(ausFeature);
            }
        });
}

drawMap();