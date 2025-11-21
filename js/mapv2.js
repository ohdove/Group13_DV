(function() {
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

  // A flat projection (Mercator) for the zoomed-in map view
  let flatProjection = d3.geoMercator()
      .translate([mapWidth / 2, mapHeight / 2]);

  // The path generator and current projection start with the orthographic projection
  let projection = orthographicProjection;
  let path = d3.geoPath().projection(projection);

  // Create the main SVG container - TARGET SECOND #mapChartContainer
  const svg = d3.selectAll("#mapChartContainer")
    .append("svg")
    .attr("width", mapWidth)
    .attr("height", mapHeight)
    .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`);

  // Group element to hold map features
  const g = svg.append("g");

  // Tooltip setup
  const tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
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
        
        const dataMapLocal = new Map();
        filteredData.forEach(d => {
            const fullName = JURISDICTION_MAP[d.JURISDICTION.toUpperCase()];
            if (fullName) {
                dataMapLocal.set(fullName, +d.Total_Positive_Count);
            }
        });
        
        // Update color scale domain based on the filtered data
        const choroplethValues = Array.from(dataMapLocal.values());
        if (choroplethValues.length > 0) {
            colorScale.domain([d3.min(choroplethValues), d3.max(choroplethValues)]);
        } else {
            colorScale.domain([0, 100]); // Default domain if no data
        }
        return dataMapLocal;
    }

    // Helper function to attach mouse events
    function attachMouseEvents(selection) { 
    selection
        .on("mouseover", function (event, d) {
        const stateName = d.properties.STATE_NAME || d.properties.name; 
        const shortForm = SHORT_FORM_MAP[stateName];
        const value = dataMap.get(stateName);
        const valueText = value !== undefined ? d3.format(",")(value) : "N/A";

        // get the fill color of the state for the swatch
        const color = d3.select(this).attr("fill") || "#777";

        const hoverStroke = stateName === "Australian Capital Territory" ? 5 : 2; 
        d3.select(this)
            .attr("stroke-width", hoverStroke)
            .attr("stroke", "#000"); 

        tooltip
            .style("opacity", 1)
            .html(`
            <strong class="tooltip-header">
                ${stateName}${shortForm ? ` (${shortForm})` : ""}
            </strong>

            <div class="tooltip-row">
                <span class="tooltip-swatch" style="background:${color};"></span>
                <span>Year: ${targetYear}</span>
            </div>

            <div class="tooltip-row">
                <span style="margin-left: 22px;">Positive tests: ${valueText}</span>
            </div>
            `)
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function (event) {
        tooltip
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
        tooltip.style("opacity", 0);
        d3.select(this)
            .attr("stroke-width", 0.5)
            .attr("stroke", "#ffffff");
        })
        .on("click", resetToWorld); // Click resets to world map
    }


  // --- Australian Choropleth Drawing Function ---
  function drawAusChoropleth() {
    // Remove old states + labels if they exist
    g.selectAll("path.state").remove();
    g.selectAll("text.state-label").remove();

    // 1. Draw the Australian states as an overlay
    const states = g.selectAll("path.state")
        .data(ausStatesGeoJson.features)
        .join("path")
        .attr("class", "state")
        .attr("d", path)
        .attr("fill", d => {
            const stateName = d.properties.STATE_NAME || d.properties.name; 
            const value = dataMap.get(stateName); 
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

    // 2. Add jurisdiction labels (short code) at state centroids
    g.selectAll("text.state-label")
        .data(
            ausStatesGeoJson.features.filter(f => {
                const fullName = f.properties.STATE_NAME || f.properties.name;
                return fullName !== "Other Territories";   
            })
        )
        .join("text")
        .attr("class", "state-label")
        .attr("transform", d => {
            const [x, y] = path.centroid(d);
            return `translate(${x},${y})`;
        })
        .attr("dy", "0.35em")
        .text(d => {
            const fullName = d.properties.STATE_NAME || d.properties.name;
            // Use SHORT_FORM_MAP if available, else full name
            return SHORT_FORM_MAP[fullName] || fullName;
        })
        .style("text-anchor", "middle")
        .style("pointer-events", "none")  // don't block hover/click on the shapes
        .style("fill", "#000")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("opacity", 0)
        .transition()
        .duration(500)
        .style("opacity", 1);

    // Fade-in transition for states
    states.style("opacity", 0) 
        .transition().duration(500)
        .style("opacity", 1);
}


  function updateYearText() {
      d3.selectAll("#map-current-year")
        .text(targetYear);
  }

  // --- Dynamic Filter Creation ---
    function createYearFilter() {
  // Use the only slider + label we have now
  const slider = d3.select("#map-year-filter");
  const yearLabel = d3.select("#map-year-label");

  if (!slider.node() || !yearLabel.node()) {
    console.error("Map slider or year label not found");
    return;
  }

  // Sort years ASC so bottom = earliest, top = latest
  const sortedYears = availableYears.slice().sort(d3.ascending);

  slider
    .attr("min", 0)
    .attr("max", sortedYears.length - 1)
    .attr("step", 1);

  function updateYearLabel(index) {
    const n = sortedYears.length;
    if (n === 0) {
      yearLabel.text("No data");
      return;
    }

    let ratio;
    if (n === 1) {
      ratio = 0.5;
    } else {
      ratio = index / (n - 1);
    }

    let topPct = (1 - ratio) * 100;
    topPct = Math.max(5, Math.min(95, topPct));

    yearLabel
      .style("top", topPct + "%")
      .text(sortedYears[index]);
  }

  const initialIndex = sortedYears.length > 0 ? sortedYears.length - 1 : 0;
  targetYear = sortedYears[initialIndex];
  slider.property("value", initialIndex);
  updateYearText();
  updateYearLabel(initialIndex);
  updateLegend();

  slider.on("input", function () {
  const idx = +this.value;
  targetYear = sortedYears[idx];

  updateYearText();
  updateMap();
  updateLegend();
  updateYearLabel(idx);

  // 🔽 NEW: if user moves slider while still on world view, zoom into Australia
  if (currentView === 'world' && ausFeature) {
    zoomToAustralia(ausFeature);
  }
});
}



  function updateLegend() {
  const legendContainer = d3.selectAll("#map-legend")

  if (!legendContainer.node()) return;

  const scaleRange = colorScale.range();
  if (scaleRange.length < 2) {
      legendContainer.selectAll(".legend-item").remove();
      return;
  }

  // Only keep the lightest and darkest colours
  const lightColor = scaleRange[0];
  const darkColor  = scaleRange[scaleRange.length - 1];

  const legendData = [
      { color: lightColor, label: "Low positive rate" },
      { color: darkColor,  label: "High positive rate" }
  ];

  const items = legendContainer
      .selectAll(".legend-item")
      .data(legendData);

  const enter = items.enter()
      .append("div")
      .attr("class", "legend-item");

  enter.append("span").attr("class", "legend-swatch");
  enter.append("span").attr("class", "legend-label");

  items.exit().remove();

  const merged = enter.merge(items);

  merged.select(".legend-swatch")
      .style("background-color", d => d.color);

  merged.select(".legend-label")
      .text(d => d.label);
}

  // --- Function to update the map when the year changes ---
  function updateMap() {
      // 1. Re-process data for the new targetYear
      dataMap = transformData(fullData, targetYear);
      
      // 2. If zoomed in, re-draw the choropleth
      if (currentView === 'aus') {
          drawAusChoropleth();
      }

       updateLegend();
      
      console.log(`Map data updated for year: ${targetYear}`);
  }

  // --- Helper Functions ---
  function moveContainerDown() {
      d3.selectAll("#mapChartContainer")

        .classed("zoomed", true);
  }

  function moveContainerUp() {
      d3.selectAll("#mapChartContainer")

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
              // Show the year filter control after zoom is complete (second one)
              d3.selectAll("#map-controls")
                .filter((d, i) => i === 1)
                .style("display", "flex");
          });
  }

  function resetToWorld() {
      if (currentView !== 'aus') return;
      currentView = 'world'; 

      // Hide the year filter control immediately when resetting
      d3.selectAll("#map-controls")
        .filter((d, i) => i === 1)
        .style("display", "none");

      moveContainerUp();

      // Hide the tooltip immediately when resetting the map
      tooltip.style("opacity", 0);

      g.selectAll("path.state")
          .on("mouseover", null)
          .on("mousemove", null)
          .on("mouseout", null)
          .on("click", null);

      // 1. Fade out the Choropleth 
      g.selectAll("path.state")
        .transition().duration(500)
        .style("opacity", 0)
        .remove();

        g.selectAll("text.state-label")
            .transition().duration(500)
            .style("opacity", 0)
            .remove();

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
  updateLegend();
})();
