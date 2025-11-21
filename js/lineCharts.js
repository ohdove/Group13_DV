document.addEventListener('DOMContentLoaded', function() {
    const margin = { top: 60, right: 50, bottom: 80, left: 85 },
          width = 700 - margin.left - margin.right, 
          height = 550 - margin.top - margin.bottom;
          
    const ageOrder = ['0-16', '17-25', '26-39', '40-64', '65 & over'];
    const metrics = ['FINES', 'ARRESTS', 'CHARGES'];
    const dataKeys = ['Mean(Sum(FINES))', 'Mean(Sum(ARRESTS))', 'Mean(Sum(CHARGES))'];

    const colorScale = d3.scaleOrdinal()
        .domain(metrics)
        .range(['#1f77b4', '#2ca02c', '#ff7f0e']);

    const alcoholDataPath = 'data/LineChart_FinesChargesArrests_byAgeGroup_2024_alcohol.csv';
    const drugDataPath = 'data/LineChart_FinesChargesArrests_byAgeGroup_2024_drug.csv'; 

    Promise.all([
        d3.csv(alcoholDataPath, parseRow),
        d3.csv(drugDataPath, parseRow)
    ]).then(function(data) {
        const alcoholData = data[0];
        const drugData = data[1];
        
        const allJurisdictions = Array.from(new Set([
            ...alcoholData.map(d => d.JURISDICTION).filter(j => j),
            ...drugData.map(d => d.JURISDICTION).filter(j => j)
        ]));
        allJurisdictions.sort();
        
        if (allJurisdictions.length > 0) {
            populateFilter(allJurisdictions);
            
            const initialJurisdiction = allJurisdictions[0];
            const initialAlcoholData = alcoholData.filter(d => d.JURISDICTION === initialJurisdiction);
            const initialDrugData = drugData.filter(d => d.JURISDICTION === initialJurisdiction);
            
            drawLineChart(initialAlcoholData, '#alcohol-chart', 'Fines, Arrests, and Charges by Age Group for Alcohol Test', width, height, margin, colorScale, ageOrder, metrics, dataKeys);
            drawLineChart(initialDrugData, '#drug-chart', 'Fines, Arrests, and Charges by Age Group for Drug Test', width, height, margin, colorScale, ageOrder, metrics, dataKeys);
            
            drawLegend(metrics, colorScale);

            d3.select('#jurisdiction-filter').on('change', function() {
                const selectedJurisdiction = d3.select(this).property('value');
                updateCharts(selectedJurisdiction, alcoholData, drugData, width, height, margin, colorScale, ageOrder, metrics, dataKeys);
            });
            
        } else {
             d3.select('#alcohol-chart').html('<p style="text-align: center; color: red;">Error: No data or jurisdictions found in either CSV file.</p>');
             d3.select('#drug-chart').html('<p style="text-align: center; color: red;">Error: No data or jurisdictions found in either CSV file.</p>');
        }

    }).catch(function(error) {
         d3.select('#alcohol-chart').html('<p style="text-align: center; color: red;">FATAL ERROR: Failed to load one or both CSV files. Check file paths and server configuration.</p>');
         d3.select('#drug-chart').html('<p style="text-align: center; color: red;">FATAL ERROR: Failed to load one or both CSV files. Check file paths and server configuration.</p>');
    });

    // Normalize age group names to handle different formats in CSV
    function normalizeAgeGroup(ageStr) {
        if (!ageStr) return '';
        const trimmed = ageStr.trim();
        const normalized = trimmed
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .replace(/&/g, '&')    // Normalize ampersand
            .replace(/and/gi, '&') // Replace "and" with &
            .replace(/\bover\b/gi, 'over') // Normalize "over"
            .replace(/65\s*&\s*over/i, '65 & over') // Standardize 65 & over
            .replace(/65\+/i, '65 & over'); // Handle 65+ format
        return normalized;
    }

    function parseRow(d) {
        // Trim whitespace from keys to handle any spacing issues
        d.JURISDICTION = (d.JURISDICTION || '').trim(); 
        d.AGE_GROUP = normalizeAgeGroup(d.AGE_GROUP);
        
        // Parse numeric values, ensuring proper conversion
        d.FINES = +d[dataKeys[0]] || 0;
        d.ARRESTS = +d[dataKeys[1]] || 0;
        d.CHARGES = +d[dataKeys[2]] || 0;
        return d;
    }

    function populateFilter(jurisdictions) {
        const select = d3.select('#jurisdiction-filter');
        select.selectAll('option')
            .data(jurisdictions)
            .enter()
            .append('option')
            .attr('value', d => d)
            .text(d => d);
    }
    
    function drawLegend(metrics, colorScale) {
        d3.select('#chart-legend').select('svg').remove(); 
        
        const legendWidth = metrics.length * 180 + 50; 
        
        const legendSvg = d3.select('#chart-legend').append('svg')
            .attr('width', legendWidth) 
            .attr('height', 45)
            .append('g')
            .attr('transform', `translate(25, 5)`);

        const legendGroup = legendSvg.selectAll(".legend")
            .data(metrics)
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => `translate(${i * 180}, 0)`); 

        legendGroup.append("line")
            .attr("x1", 0)
            .attr("y1", 15) 
            .attr("x2", 35)
            .attr("y2", 15)
            .attr("stroke", colorScale)
            .attr("stroke-width", 5);
            
        legendGroup.append("circle")
            .attr("cx", 17.5)
            .attr("cy", 15) 
            .attr("r", 7)
            .attr("fill", colorScale)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2); 

        legendGroup.append("text")
            .attr("x", 45)
            .attr("y", 15)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .style('font-size', '16px')
            .text(d => d);
    }

    function drawLineChart(data, containerId, title, width, height, margin, colorScale, ageOrder, metrics) { 
        d3.select(containerId).select('svg').remove();
        d3.select(containerId).select('.no-data-message').remove();

        if (data.length === 0) {
            d3.select(containerId)
                .append('p')
                .attr('class', 'no-data-message')
                .style('text-align', 'center')
                .style('padding-top', '50px')
                .style('color', '#888')
                .text(`No data available for the selected jurisdiction in this dataset.`);
            return;
        }

        const ageGroupData = d3.group(data, d => d.AGE_GROUP);
        
        // Prepare series data, including null for missing age groups
        const series = metrics.map(metric => ({
            name: metric,
            values: ageOrder.map(age => {
                const items = ageGroupData.get(age);
                
                if (!items || items.length === 0) {
                    return { age: age, value: null }; 
                }
                
                const value = items[0][metric];         
                return {
                    age: age,
                    value: (value === 0 || value) ? value : null // Handle 0 and other values, but ensure explicit null for missing
                };
            })
        }));

        const allValues = series.flatMap(s => s.values.map(v => v.value)).filter(v => v !== null);
        const maxOutcome = d3.max(allValues);
        
        let yDomainMax;
        let customTicks;
        let tickFormat;

        if (!maxOutcome || maxOutcome === 0) {
            yDomainMax = 1.0; 
            customTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
            tickFormat = d3.format(".1f");
        } else if (maxOutcome > 0 && maxOutcome <= 1.0) {
            yDomainMax = 1.0; 
            customTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0]; 
            tickFormat = d3.format(".1f"); 
        } else if (maxOutcome > 1 && maxOutcome < 10) {
            const ceilMax = Math.ceil(maxOutcome);
            yDomainMax = ceilMax;
            customTicks = d3.range(0, ceilMax + 1);
            tickFormat = d3.format(".0f");
        } else {
            const tempY = d3.scaleLinear()
                .domain([0, maxOutcome])
                .nice(5); 
            yDomainMax = tempY.domain()[1];
            customTicks = null; 
            tickFormat = d3.format("~s"); 
        }

        // X-Scale: Use the full ageOrder for the domain to ensure all ticks are present
        const x = d3.scalePoint()
            .domain(ageOrder)
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, yDomainMax]) 
            .range([height, 0]);
            
        const line = d3.line()
            .defined(d => d.value !== null && d.value !== undefined)
            .x(d => x(d.age))
            .y(d => y(d.value));

        const svg = d3.select(containerId)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
            
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -40)
            .attr('text-anchor', 'middle')
            .style('font-size', '19px')
            .style('font-weight', 'bold')
            .style('fill', 'rgb(54, 44, 27)')
            .text(title);

        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickPadding(14))
            .style('font-size', '13px');
            
        svg.append("text")
            .attr("transform", `translate(${width / 2}, ${height + margin.bottom -10})`)
            .style("text-anchor", "middle")
            .style('font-weight', 'bold')
            .style('font-size', '16px')
            .text("AGE GROUP"); 

        const yAxis = d3.axisLeft(y)
            .tickValues(customTicks) 
            .tickFormat(tickFormat)
            .tickPadding(10); 
        
        if (customTicks === null) {
            yAxis.ticks(5);
        }

        svg.append('g')
            .call(yAxis)
            .style('font-size', '13px');
            
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left)
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style('font-weight', 'bold')
            .style('font-size', '16px')
            .text("Total Count of Fines, Arrests, and Charges"); 
            
        const lines = svg.selectAll('.series-line')
            .data(series)
            .enter()
            .append('g')
            .attr('class', 'series-line');
            
        lines.append('path')
            .attr('fill', 'none')
            .attr('stroke', d => colorScale(d.name))
            .attr('stroke-width', 3)
            .attr('d', d => line(d.values));
            
        // Draw circles only for points that have a value
        lines.selectAll('.data-point')
            .data(d => d.values.filter(v => v.value !== null && v.value !== undefined))
            .enter()
            .append('circle')
            .attr('class', 'data-point')
            .attr('cx', d => x(d.age))
            .attr('cy', d => y(d.value))
            .attr('r', 5)
            .attr('fill', function(d) { return colorScale(d3.select(this.parentNode).datum().name); }) 
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .style("cursor", "pointer");
        
        // Create hover zones for each age group
        const hoverZones = svg.selectAll('.hover-zone')
            .data(ageOrder) 
            .enter()
            .append('rect')
            .attr('class', 'hover-zone')
            .attr('x', d => x(d) - 25) 
            .attr('y', 0)
            .attr('width', 50)
            .attr('height', height)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer')
            .on('mouseover', function(event, age) {
                // Highlight all circles for this age group
                svg.selectAll('.data-point')
                    .filter(d => d.age === age)
                    .attr('r', 8)
                    .attr('stroke-width', 2.5);
                
                showCombinedTooltip(event, age, series);
            })
            .on('mouseout', function(event, age) {
                // Reset all circles for this age group
                svg.selectAll('.data-point')
                    .filter(d => d.age === age)
                    .attr('r', 5)
                    .attr('stroke-width', 1.5);
                
                hideTooltip();
            });
        
        let tooltip = d3.select("body").select(".chart-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body").append("div")
                .attr("class", "chart-tooltip")
                .style("opacity", 0)
                .style("position", "absolute")
                .style("pointer-events", "none")
        }
        
        // Show combined tooltip with ALL metrics for an age group
        function showCombinedTooltip(event, age, series) {
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            
            // Build HTML for all metrics
            let html = `<strong class="tooltip-header">Age Group: ${age}</strong>`;
            
            series.forEach(s => {
                const dataPoint = s.values.find(v => v.age === age);
                const valueText = (dataPoint && dataPoint.value !== null && dataPoint.value !== undefined) 
                    ? `<strong>${d3.format(",.0f")(dataPoint.value)}</strong>`
                    : 'No data';
                
                const color = colorScale(s.name);
                const opacity = (dataPoint && dataPoint.value !== null && dataPoint.value !== undefined) ? 1.0 : 0.5;

                html += `
                    <div style="margin: 6px 0; display: flex; align-items: center; opacity: ${opacity};">
                        <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 8px; border: 2px solid white;"></div>
                        <span style="flex: 1;"><strong>${s.name}:</strong></span>
                        <span style="margin-left: 8px;">${valueText}</span>
                    </div>
                `;
            });
            
            tooltip.html(html)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        }
            
        function hideTooltip() {
            tooltip.transition()
                .duration(300)
                .style("opacity", 0);
        }
    }

    function updateCharts(selectedJurisdiction, alcoholData, drugData, width, height, margin, colorScale, ageOrder, metrics) {
        const filteredAlcohol = alcoholData.filter(d => d.JURISDICTION === selectedJurisdiction);
        const filteredDrug = drugData.filter(d => d.JURISDICTION === selectedJurisdiction);
        
        drawLineChart(filteredAlcohol, '#alcohol-chart', 'Fines, Arrests, and Charges by Age Group for Alcohol Test', width, height, margin, colorScale, ageOrder, metrics);
        drawLineChart(filteredDrug, '#drug-chart', 'Fines, Arrests, and Charges by Age Group for Drug Test', width, height, margin, colorScale, ageOrder, metrics);
    }
});