// js/barChart.js
document.addEventListener("DOMContentLoaded", function () {

  const container = document.getElementById("barChartContainer");
  const margin = { top: 30, right: 20, bottom: 60, left: 70 };
  const width = 700 - margin.left - margin.right;
  const height = 550 - margin.top - margin.bottom;

  d3.select("#barChartContainer").selectAll("*").remove();

  const svg = d3.select("#barChartContainer")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const testTypeSelect = document.getElementById("bar-test-type");

  // Tooltip element
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "chart-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("opacity", 0)

  d3.csv("data/BarChart_PositiveCountbyTestType.csv").then(raw => {

    const data = raw.map(d => ({
      AGE_GROUP: d.AGE_GROUP,
      breath: +d["Mean(Positive_Breath_Tests)"],
      drug: +d["Mean(Positive_Drug_Tests)"],
      all: +d.Total_Positive_Count
    }));

    // X scale
    const x = d3.scaleBand()
      .domain(data.map(d => d.AGE_GROUP))
      .range([0, width])
      .padding(0.3);

    // Y scale
    const y = d3.scaleLinear().range([height, 0]);

    // Colors
    const color = {
      breath: "#4ba3ff",
      drug: "#ff8c42",
      all: "#6a5acd"
    };

    // X axis
    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")              
      .attr("dy", "1em")              
      .style("text-anchor", "middle")   
      .style("font-size", "12px")    
      .style("fill", "#333");        

    // Y axis
    svg.append("g").attr("class", "y-axis");

    // Chart Title
    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", width / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "bold")
        .text("Mean Positive Test Count by Age Group");

    // Y Axis Label
    svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left)
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style('font-weight', 'bold')
            .style('font-size', '16px')
            .text("Positive Count"); 
            
    // X Axis Label
    svg.append("text")
            .attr("transform", `translate(${width / 2}, ${height + margin.bottom -10})`)
            .style("text-anchor", "middle")
            .style('font-weight', 'bold')
            .style('font-size', '16px')
            .text("AGE GROUP"); 

    // UPDATE FUNCTION
    function updateChart() {
        const type = testTypeSelect.value;

      const maxVal = d3.max(data, d => d[type]);
      y.domain([0, maxVal * 1.1]);

      svg.select(".y-axis")
        .transition()
        .duration(600)
        .call(d3.axisLeft(y));

      const bars = svg.selectAll("rect.bar")
        .data(data, d => d.AGE_GROUP);

      // EXIT
      bars.exit()
        .transition().duration(300)
        .attr("height", 0)
        .attr("y", height)
        .remove();

      // ENTER + UPDATE
      bars.enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.AGE_GROUP))
        .attr("width", x.bandwidth())
        .attr("y", height)
        .attr("height", 0)
        .merge(bars)
        .on("mouseover", function (event, d) {
          tooltip.style("opacity", 1);
        })
        .on("mousemove", function (event, d) {
            const type = testTypeSelect.value;

            const typeLabel = 
                type === "all" ? "All Tests" :
                type === "breath" ? "Breath Test" :
                "Drug Test";

            const barColor = color[type]; 
            const valueText = d3.format(".1f")(d[type]);

            tooltip
                .html(`
                    <strong class="tooltip-header">Age Group: ${d.AGE_GROUP}</strong>
                    
                    <div class="tooltip-row">
                        <div></div> 
                        <span style="flex: 1;"><strong>Test Type:</strong></span>
                        
                        <div class="tooltip-swatch" style="background: ${barColor || '#fff'}; margin-left: 8px; margin-right: 4px;"></div>
                        <span style="margin-left: 0px;">${typeLabel}</span>
                    </div>

                    <div class="tooltip-row">
                        <div></div>
                        <span style="flex: 1;"><strong>Count:</strong></span>
                        <span style="margin-left: 8px;">${valueText}</span>
                    </div>
                `)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", function () {
          tooltip.style("opacity", 0);
        })
        .transition()
        .duration(700)
        .attr("x", d => x(d.AGE_GROUP))
        .attr("y", d => y(d[type]))
        .attr("height", d => height - y(d[type]))
        .attr("fill", color[type]);
    }

    // DEFAULT
    testTypeSelect.value = "all";
    updateChart();

    testTypeSelect.addEventListener("change", updateChart);
  });
});