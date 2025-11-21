
(function () {
  console.log("[Sunburst] script loaded");

  // --- 1. Basic sanity checks ---
  if (typeof d3 === "undefined") {
    console.error("[Sunburst] d3 not found. Make sure d3.v7 is loaded before this script.");
    return;
  }

  const container = d3.select("#sunburst-container");
  if (!container.node()) {
    console.error("[Sunburst] #sunburst-container not found in DOM.");
    return;
  }

  // set size and path 
  const width  = 500;
  const height = 500;
  const radius = Math.min(width, height) / 2;

  const DATA_PATH = "data/Sunburst_FinesArrestsCharges_byJurisdictionTestType_2024.csv";

  // color by outcome (outer leaves)
  const outcomeColor = d3.scaleOrdinal()
    .domain(["Fines", "Arrests", "Charges"])
    .range(["#5d90c6ff", "#a9e8b3ff", "#8bd7d4ff"]);

  let fullData = [];
  let jurisdictions = [];
  let currentJurisdiction = null;

  // warning note for the 4 jurisdictions
  const WARNING_TEXTS = {
    "VIC": "Note: Fines, arrests and charges data cannot be provided since the database only provides detection data.",
    "TAS": "Note: Fines, arrests and charges data cannot be provided since the database only provides detection data.",
    "NT":  "Note: Drug test data cannot be provided since the database only provides breath test data.",
    "QLD": "Note: Fines, arrests and charges data cannot be provided for breath test conducted."

  };

  // helper function for a cleaner name
  function prettyLabel(name) {
  if (!name) return "";

  const n = String(name).toLowerCase().trim();

  if (n.includes("breath"))  return "Breath tests";
  if (n.includes("drug"))    return "Drug tests";

  if (n.includes("fine"))    return "Fines";
  if (n.includes("arrest"))  return "Arrests";
  if (n.includes("charge"))  return "Charges";

  return name;
  }


  // build hierarchy root → testType → outcome 

  function buildHierarchy(rowsForJurisdiction) {
  const root = { name: "root", children: [] };

  // group by testType 
  const byTest = d3.group(rowsForJurisdiction, d => d.testType);

  for (const [testType, groupRows] of byTest.entries()) {
    const testNode = { name: testType, children: [] };

    const totals = groupRows.reduce(
      (acc, r) => {
        acc.Fines      += r.fines      || 0;
        acc.Arrests    += r.arrests    || 0;
        acc.Charges    += r.charges    || 0;
        acc.TotalTests += r.totalTests || 0;
        return acc;
      },
      { Fines: 0, Arrests: 0, Charges: 0, TotalTests: 0 }
    );

    testNode.totalTests = totals.TotalTests;

    const hasOutcomeBreakdown =
      totals.Fines > 0 || totals.Arrests > 0 || totals.Charges > 0;

    if (hasOutcomeBreakdown) {

      // 2nd layer- outcomes
      if (totals.Fines > 0)   testNode.children.push({ name: "Fines",   value: totals.Fines });
      if (totals.Arrests > 0) testNode.children.push({ name: "Arrests", value: totals.Arrests });
      if (totals.Charges > 0) testNode.children.push({ name: "Charges", value: totals.Charges });


    } else if (totals.TotalTests > 0) {
      // No breakdown, but we have total tests as single ring leaf
      testNode.value = totals.TotalTests;
    }

    // Only keep this testType if it has either children or a value
    if (testNode.children.length > 0 || testNode.value > 0) {
      root.children.push(testNode);
    }
  }

  return root;
}

  // Helper function for the warning icon for 4 jurisdictions 

  function renderWarningIcon() {

    // Remove any previous icon + tooltip
    container.selectAll(".sunburst-warning-icon").remove();
    container.selectAll(".sunburst-warning-tooltip").remove();

    if (!currentJurisdiction || !WARNING_TEXTS[currentJurisdiction]) {
        return; // nothing to show for this jurisdiction
    }

    const warningText = WARNING_TEXTS[currentJurisdiction];

    const icon = container.append("div")
        .attr("class", "sunburst-warning-icon")
        .html("!");

    // Tooltip box for the icon
    const tip = container.append("div")
        .attr("class", "sunburst-warning-tooltip")
        .style("opacity", 0)
        .text(warningText);

    icon
        .on("mouseover", () => {
        tip.style("opacity", 1);
        })
        .on("mouseout", () => {
        tip.style("opacity", 0);
        });
  }


  // Draw sunburst chart

  function drawSunburst() {
    console.log("[Sunburst] drawSunburst, fullData rows:", fullData.length,
                "currentJurisdiction:", currentJurisdiction);

    container.selectAll("*").remove(); // clear container

    if (!fullData.length) {
      container.append("p").text("No data available.");
      return;
    }

    // Filter by selected jurisdiction
    const rows = currentJurisdiction
      ? fullData.filter(r => r.jurisdiction === currentJurisdiction)
      : fullData;

    if (!rows.length) {
      container.append("p")
        .text(`No data for jurisdiction: ${currentJurisdiction}`);
      return;
    }

    // Remove any existing chart tooltip from previous renders

    const tooltip = d3.select("body")
      .append("div")  
      .attr("class", "chart-tooltip")
      .style("opacity", 0);


    const centerLabel = container.append("div")
      .attr("id", "sunburst-center-label")
      .html(`<strong>${currentJurisdiction || "All jurisdictions"}</strong>`);

    const svg = container.append("svg")
      .attr("viewBox", [-width / 2, -height / 2, width, height]);

    const rootData = buildHierarchy(rows);

    const root = d3.hierarchy(rootData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 8, 0.01))
      .padRadius(radius / 2)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1 - 1);

    // Draw arcs for depths 1 - testtype and 2 - outcomes 
    const paths = svg.append("g")
      .selectAll("path")
      .data(root.descendants().filter(d => d.depth > 0))
      .join("path")
      .attr("d", arc)
      .attr("fill", d => {
        // leaves of 3 outcomes use outcomeColor
        if (!d.children && outcomeColor.domain().includes(d.data.name)) {
          return outcomeColor(d.data.name);
        }
        // inner nodes inherit color from a leaf descendant
        const leaf = d.leaves().find(l =>
          outcomeColor.domain().includes(l.data.name)
        );
        return leaf ? outcomeColor(leaf.data.name) : "#9faac7ff";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        const ancestors = d.ancestors().reverse().slice(1); // skip root
        const pathNames = ancestors
          .map(a => prettyLabel(a.data.name))
          .join(" → ");

        
        const isTestLayer = d.depth === 1;

        let value, labelText;

        if (isTestLayer) {
          // use Positive_Tests stored on the test node
          value = d.data.totalTests || 0;
          labelText = "total positive tests";
        } else {
          // outcome slices -> penalties
          value = d.value || 0;
          labelText = "penalties";
        }

        const color = d3.select(event.currentTarget).attr("fill");

        tooltip
          .style("opacity", 1)
          .html(`
            <strong class="tooltip-header">${pathNames}</strong>
            <div class="tooltip-row">
              <span class="tooltip-swatch" style="background:${color};"></span>
              <span>${d3.format(",")(value)} ${labelText}</span>
            </div>
          `)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });


  
    svg.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .selectAll("text")
      .data(
        root.descendants().filter(d =>
          d.depth > 0 && (d.x1 - d.x0) > 0.05
        )
      )
      .join("text")
      .attr("transform", d => {
        const x = (d.x0 + d.x1) / 2;
        const y = (d.y0 + d.y1) / 2;
        const angle = (x * 180 / Math.PI) - 90;
        return `rotate(${angle}) translate(${y},0) rotate(${angle > 90 ? 180 : 0})`;
      })
      .attr("dy", "0.32em")
      .style("font-size", "10px")
      .style("fill", "#000")
      .text(d => prettyLabel(d.data.name));

      renderWarningIcon();
  }

  // draw dropdown 
  function initWithData(rows) {
  fullData = rows;
  console.log("[Sunburst] using rows:", fullData.length);

  if (!Array.isArray(fullData) || fullData.length === 0) {
    console.error("[Sunburst] No usable rows from CSV. Check DATA_PATH and column names.");
    return;
  }

  // Build jurisdiction list
  jurisdictions = Array.from(
    new Set(fullData.map(d => d.jurisdiction).filter(Boolean))
  ).sort();

  // 🔹 Use the existing dropdown only (no dynamic creation)
  const dropdown = d3.select("#sunburst-jurisdiction");

  

  // Populate options
  dropdown
    .selectAll("option")
    .data(jurisdictions)
    .join("option")
    .attr("value", d => d)
    .text(d => d);

  // Default to first jurisdiction
  currentJurisdiction = jurisdictions[0] || null;
  dropdown.property("value", currentJurisdiction);

  dropdown.on("change", function () {
    currentJurisdiction = this.value;
    drawSunburst();
  });

  drawSunburst();
}


  d3.csv(DATA_PATH).then(raw => {
  console.log("[Sunburst] raw CSV rows:", raw.length);

  const rows = raw.map(d => {
    return {
        jurisdiction: (d.JURISDICTION || "").trim(),

        testType: (d.METRIC || "").trim(),

        fines: +d.FINES || 0,
        arrests: +d.ARRESTS || 0,
        charges: +d.CHARGES || 0,
        totalTests: +d.Positive_Tests || 0
    };
  }).filter(r =>
    r.jurisdiction &&
    r.testType &&
    (r.fines !== 0 ||
     r.arrests !== 0 ||
     r.charges !== 0 ||
     r.totalTests !== 0)  
  );

  console.log("[Sunburst] cleaned rows (after filter):", rows.length);
  console.log("[Sunburst] sample row:", rows[0]);
  initWithData(rows);
}).catch(err => {
  console.error("[Sunburst] CSV error:", err);
});


})();
