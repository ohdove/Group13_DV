// js/pieChart.js
document.addEventListener("DOMContentLoaded", function () {
  // dimensions (responsive-ish)
  const container = document.getElementById("pie-chart-container");
  const width = Math.min(480, Math.max(380, container.clientWidth || 420));
  const height = 420;
  const radius = Math.min(width, height) / 2 - 20;

  // remove any previous svg (defensive)
  d3.select("#pieChartSVG").selectAll("*").remove();

  const svg = d3.select("#pieChartSVG")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  // color palette (single hue, three shades)
  const color = d3.scaleOrdinal()
    .domain(["Fines", "Arrests", "Charges"])
    .range(["#cfe7ff", "#6faeff", "#0b66ff"]);

  const pie = d3.pie()
    .sort(null)
    .value(d => d.value);

  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

  const arcHover = d3.arc()
    .innerRadius(0)
    .outerRadius(radius + 12);

  // tooltip
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "chart-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("opacity", 0);

  // legend container (clear and create)
  d3.select("#pie-legend").remove();
  const legendContainer = d3.select("#pie-chart-container")
    .append("div")
    .attr("id", "pie-legend")
    .style("margin-top", "12px");

  // load CSV
  d3.csv("data/PieChart_FinesArrestsCharges_byJurisdictionTestType_2024.csv").then(raw => {

    // METRIC, JURISDICTION, Mean(Sum(FINES)), Mean(Sum(ARRESTS)), Mean(Sum(CHARGES))

    // Normalize header names (in case of BOM/whitespace)
    const data = raw.map(r => {
      return {
        METRIC: (r.METRIC || r.Metric || r.metric || "").trim(),
        JURISDICTION: (r.JURISDICTION || r.Jurisdiction || r.jurisdiction || "").trim(),
        Fines: + (r["Mean(Sum(FINES))"] || r["Mean (Sum(FINES))"] || r["Mean_Sum_FINES"] || 0),
        Arrests: + (r["Mean(Sum(ARRESTS))"] || r["Mean (Sum(ARRESTS))"] || r["Mean_Sum_ARRESTS"] || 0),
        Charges: + (r["Mean(Sum(CHARGES))"] || r["Mean (Sum(CHARGES))"] || r["Mean_Sum_CHARGES"] || 0)
      };
    });

    // populate jurisdiction dropdown (use order from CSV unique)
    const jurisdictions = Array.from(new Set(data.map(d => d.JURISDICTION))).filter(Boolean);
    const jurisdictionSelect = document.getElementById("pie-jurisdiction");
    jurisdictions.forEach(j => {
      const opt = document.createElement("option");
      opt.value = j;
      opt.textContent = j;
      jurisdictionSelect.appendChild(opt);
    });
    if (jurisdictions.length) jurisdictionSelect.value = jurisdictions[0];

    // test type select already exists in HTML with values matching METRIC such as:
    // breath_tests_conducted, drug_tests_conducted
    const testTypeSelect = document.getElementById("pie-test-type");

    // function to build and update legend
    function renderLegend() {
      legendContainer.selectAll("*").remove();
      const items = ["Fines", "Arrests", "Charges"];
      const legend = legendContainer.append("div")
        .attr("class", "legend-items")
        .style("display", "flex")
        .style("gap", "12px")
        .style("justify-content", "center");
      items.forEach(key => {
        const item = legend.append("div")
          .attr("class", "legend-item")
          .style("display", "flex")
          .style("align-items", "center")
          .style("gap", "6px")
          .style("font-size", "0.95rem");
        item.append("span")
          .style("display", "inline-block")
          .style("width", "18px")
          .style("height", "12px")
          .style("background", color(key))
          .style("border-radius", "3px");
        item.append("span").text(key);
      });
    }

    // update function
    function updateChart() {
      const selectedJurisdiction = jurisdictionSelect.value;
      const selectedTestType = testTypeSelect.value;

      // find matching row
      const row = data.find(d => d.JURISDICTION === selectedJurisdiction && d.METRIC === selectedTestType);

      // if not found, show zeroed chart
      const fines = row ? +row.Fines : 0;
      const arrests = row ? +row.Arrests : 0;
      const charges = row ? +row.Charges : 0;

      const chartData = [
        { label: "Fines", value: fines },
        { label: "Arrests", value: arrests },
        { label: "Charges", value: charges }
      ];

      const total = chartData.reduce((s, c) => s + (isNaN(c.value) ? 0 : c.value), 0);

      // bind data
      const paths = svg.selectAll("path.slice")
        .data(pie(chartData), d => d.data.label);

      // exit
      paths.exit()
        .transition().duration(250)
        .attr("opacity", 0)
        .remove();

      // enter + update
      paths.enter()
        .append("path")
        .attr("class", "slice")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function (event, d) {
            d3.select(this).transition().duration(150).attr("d", arcHover);
            tooltip.transition().duration(150).style("opacity", 1);

            // Use the percentage shown in the slice itself
            const pct = (d.endAngle - d.startAngle) / (2 * Math.PI) * 100;
            const value = d.data.value;
            const valueText = Number(value).toLocaleString();

            tooltip.html(`
                <strong class="tooltip-header">${d.data.label}</strong>
              
                <div class="tooltip-row">
                    <div></div> 
                    <span style="flex: 1;"><strong>Jurisdiction:</strong></span>
                    <span style="margin-left: 8px;">${selectedJurisdiction}</span>
                </div>
                
                <div class="tooltip-row">
                    <div></div> 
                    <span style="flex: 1;"><strong>Count:</strong></span>
                    <span style="margin-left: 8px;">${valueText}</span>
                </div>

                <div class="tooltip-row">
                    <div></div>
                    <span style="flex: 1;"><strong>Share:</strong></span>
                    <span style="margin-left: 0px;">${pct.toFixed(1)}%</span>
                </div>
            `);
        })

        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this).transition().duration(150).attr("d", arc);
            tooltip.transition().duration(150).style("opacity", 0);
        })
        .merge(paths)
        .transition()
        .duration(600)
        .attrTween("d", function (d) {
            const current = this._current || d;
            const interpolate = d3.interpolate(current, d);
            this._current = interpolate(0);
            return t => arc(interpolate(t));
        })
        .attr("fill", d => color(d.data.label))
        .attr("opacity", d => d.data.value === 0 ? 0.35 : 1);


      // LABELS: percentage + small value optionally
      const label = svg.selectAll("text.pie-label")
        .data(pie(chartData), d => d.data.label);

      label.exit().remove();

      label.enter()
        .append("text")
        .attr("class", "pie-label")
        .attr("dy", "0.35em")
        .style("font-size", "12px")
        .style("text-anchor", "middle")
        .merge(label)
        .transition().duration(600)
        .attr("transform", d => {
          const c = arc.centroid(d);
          // push label slightly outwards
          const k = 1.25;
          return `translate(${c[0] * k}, ${c[1] * k})`;
        })
        .text(d => {
          const val = d.data.value;
          if (!val || total === 0) return "";
          const pct = (val / total) * 100;
          return `${pct.toFixed(1)}%`;
        });


      renderLegend();
    }

    // initial draw & listeners
    updateChart();
    jurisdictionSelect.addEventListener("change", updateChart);
    testTypeSelect.addEventListener("change", updateChart);
  }).catch(err => {
    console.error("Failed to load CSV for pie chart:", err);
    // show friendly message
    d3.select("#pieChartSVG").append("div").text("Data failed to load.");
  });
});