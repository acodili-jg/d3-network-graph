// TODO proper add/remove
// TODO resizability
// TODO renaming
// TODO helper functions go brrrr


function isFunction(obj) {
    return typeof obj === 'function';
}

class NetGraphD3 {
    constructor(selector, options) {
        this.selector = selector;

        const {
            width = 1200,
            height = 1000,
            graphData,
            radius = 10,
            nodeColor = '#00e0fb',
            linkColor = '#a5e6ef',
            focusColor = '#ffff85',
            arrowColor = '#a5e6ef',
            textColor = '#a5e6ef',
            defaultLinkDistance = 100,
            onNodeClick,
            mouseenterNode,
            dbClickNode,
        } = options;

        this.options = {
            width,
            height,
            graphData,
            radius,
            nodeColor,
            linkColor,
            focusColor,
            arrowColor,
            textColor,
            defaultLinkDistance,
            onNodeClick,
            mouseenterNode,
            dbClickNode,
        };

        this.init();
    }

    init() {
        this.nodes = this.options.graphData.nodes.map(d => Object.create(d));
        this.links = this.options.graphData.links.map(l => Object.create(l));

        this.multiLinkGroup(this.links);

        this.simulation = d3.forceSimulation(this.nodes)
            .force(
                'link',
                d3.forceLink(this.links)
                    .distance(d => d.ng || this.options.defaultLinkDistance)
                    .id(node => node.id)
            )
            .force('collide',d3.forceCollide().radius(this.options.radius))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('x', d3.forceX())
            .force('y', d3.forceY());
    }

    show() {
        const root = d3
            .select(this.selector)
            .append('svg')
            .attr('width', this.options.width)
            .attr('height', this.options.height)
            .attr('viewBox', [
                -this.options.width / 2,
                -this.options.height / 2,
                this.options.width,
                this.options.height,
            ]);
        const transformed = root
            .append('g')
            .attr('id', `${this.options.selector}$transformed`)
            .on('dblclick.zoom', null);
        root.call(
            d3.zoom()
                .extent([[0, 0], [this.options.width, this.options.height]])
                .scaleExtent([1, 8])
                // Prevent double click zoom on nodes.
                .filter(event => !event.target.id || event.type !== 'dblclick')
                .on('zoom', event => {
                    const { x, y, k } = event.transform;
                    transformed.attr('transform', `translate(${x}, ${y}) scale(${k})`);
                }),
        )

        const glinks = transformed.append('g').attr('stroke', this.options.linkColor);
        this.link = glinks.selectAll('path');

        const gNodes = transformed.append('g').attr('stroke', '#fff').attr('stroke-width', 1);
        this.node = gNodes.selectAll('circle');

        this.linkLabels = transformed.selectAll('text');

        const defs = transformed.append('defs');
        defs.append('marker')
            .attr('id', 'arrow')
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', '6')
            .attr('markerHeight', '6')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', '10')
            .attr('refY', '0')
            .attr('fill', this.options.arrowColor)
            .attr('orient', 'auto')
            .attr('stroke-width', 1)
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5');

        this.update();
    }

    multiLinkGroup (links) {
        const linkGroup = {};
        links.forEach((link) => {
            const key = (link.source < link.target)
                ? `${link.source}&${link.target}`
                : `${link.target}&${link.source}`;
            if (!linkGroup.hasOwnProperty(key)) {
                linkGroup[key] = []
            }
            linkGroup[key].push(link)
        });

        for (const group in linkGroup) {
            const leftArr = [];
            const rightArr = [];
            if (linkGroup[group].length === 2) {
                leftArr.push(linkGroup[group][0]);
                rightArr.push(linkGroup[group][1]);
            } else {
                for (const link of linkGroup[group]) {
                    if (`${link.source}&${link.target}` === group) {
                        leftArr.push(link);
                    } else {
                        rightArr.push(link);
                    }
                }
            }
            let positive = 1;
            let negative = -1;
            if (linkGroup[group].length < 2) {
                continue;
            }
            leftArr.forEach(left => left.linknum = positive++);
            rightArr.forEach(right => right.linknum = negative--);
        }
    }

    drag(simulation) {
        function onDragStart(event) {
            if (!event.active) {
                simulation.alphaTarget(0.3).restart();
            }

            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function onDragMove(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function onDragEnd(event) {
            if (!event.active) {
                simulation.alphaTarget(0);
            }
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3
            .drag()
            .on('start', onDragStart)
            .on('drag', onDragMove)
            .on('end', onDragEnd);
    }

    updateNodeAndLinks(data) {
        const newNode = Object.create(data.node);
        const newLinks = Object.create(data.link);
        this.nodes.push(newNode);
        this.links.push(newLinks);
        this.update();
    }

    update() {
        const node = this
            .node
            .data(this.nodes, d => d.id)
            .enter()
            .append('circle')
            .attr('id', d => d.id)
            .attr('fill', d => d.color || this.options.nodeColor)
            .attr('r', d => d.r || this.options.radius)
            .merge(this.node)
            .call(this.drag(this.simulation))
            .on('mouseenter', event => {
                const node = event.target;
                this.applyFocusStyleFromNode(node);

                if (isFunction(this.options.mouseenter)) {
                    this.options.mouseenterNode(node);
                }
            })
            .on('mouseout', event => {
                const node = event.target;
                this.applyNormalStyleFromNode(node);
            })
            .on('click', event => {
                if (isFunction(this.options.onNodeClick)) {
                    this.options.onNodeClick(event);
                }
            })
            .on('dblclick', event => {
                if (isFunction(this.options.dbClickNode)) {
                    this.options.dbClickNode(event);
                }
            });
        node.append('title').text(node => node.id);

        const link = this
            .link
            .data(this.links)
            .enter()
            .append('path')
            .attr('stroke-width', 1)
            .attr('id', (d) => `link_${d.id}`)
            .attr('stroke', this.options.linkColor)
            .attr('marker-end', 'url(#arrow)')
            .merge(this.link);

        const linkLabels = this
            .linkLabels
            .data(this.links)
            .enter()
            .append('text')
            .attr('id', link => `text_${link.id}`)
            .append('textPath')
            .attr('xlink:href', link => `#link_${link.id}`)
            .text(link => link.label)
            .style('text-anchor', 'middle')
            .style('font-size', '7')
            .style('fill', this.options.textColor)
            .attr('startOffset', '50%')
            .merge(this.linkLabels);

        this.node = node;
        this.link = link;
        this.linkLabels = linkLabels;

        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);

        this.simulation.on('tick', () => {
            node.attr('cx', d => d.x).attr('cy', d => d.y);
            link.attr('d', (d) => this.normalizePath(d)).attr('fill-opacity', '0');
        });
    }

    applyNormalStyleFromNode(node) {
        const param = {
            id: node.id,
            nodeColor: node.color,
            linkColor: this.options.linkColor,
            textColor: this.options.textColor,
            nodeStrokeWidth: 1,
            fontSize: 5,
        };
        this.applyStyleFromNode(param);
    }

    applyFocusStyleFromNode(node) {
        const param = {
            id: node.id,
            nodeColor: this.options.focusColor,
            linkColor: this.options.focusColor,
            textColor: this.options.focusColor,
            nodeStrokeWidth: 3,
            fontSize: 10,
        };
        this.applyStyleFromNode(param);
    }

    applyStyleFromNode(param) {
        d3.select(`#${param.id}`)
            .attr('stroke', param.nodeColor && param.nodeColor)
            .attr('stroke-width', param.nodeColor && param.nodeStrokeWidth);

        this.links.forEach(link => {
            if (link.source.id === param.id) {
                d3.select(`#link_${link.id}`).attr('stroke', param.linkColor);
                d3.selectAll(`#text_${link.id} textPath`)
                    .style('fill', param.textColor)
                    .style('font-size', param.fontSize);
            }
        });
    }

    normalizePath(link) {
        const x1 = parseFloat(link.source.x);
        const y1 = parseFloat(link.source.y);
        const r1 = parseFloat(link.source.r || this.options.radius);
        const x2 = parseFloat(link.target.x);
        const y2 = parseFloat(link.target.y);
        const r2 = parseFloat(link.target.r || this.options.radius);

        // Get the direction vector.
        let nx = x2 - x1;
        let ny = y2 - y1;
        const mag = Math.hypot(nx, ny);
        nx /= mag;
        ny /= mag;

        // Trim parts inside circles.
        const nx1 = x1 + nx * r1;
        const ny1 = y1 + ny * r1;
        const nx2 = x2 - nx * r2;
        const ny2 = y2 - ny * r2;

        const subs = link.linknum;
        return subs ? `
            M ${nx1}, ${ny1}
            Q ${(x1 + nx2) / 2} ${(y1 + ny2) / 2 + 10 * subs}, ${nx2} ${ny2}
        ` : `
            M ${nx1}, ${ny1}
            L ${nx2}, ${ny2}
        `;
    }
}

d3.json("assets/data_network.json")
    .then(function (data) {
        let newIndex = 0;

        function onClick(event) {
            console.log(event.target.id);
        }

        function onDoubleClick(event) {
            const i = newIndex++;
            const node = event.target;
            const data = {
                node: {
                    id: `n_new_${i}`,
                    r: 10,
                    color: '#1a8436'
                },
                link: {
                    id: `l_new_${i}`,
                    label: 'Attached to',
                    source: `${node.id}`,
                    target: `n_new_${i}`,
                }
            };
            graph.updateNodeAndLinks(data);
            graph.applyFocusStyleFromNode(node);
        }

        const graph = new NetGraphD3('#app', {
            width: window.innerWidth,
            height: window.innerHeight,
            graphData: data,
            onNodeClick: onClick,
            dbClickNode: setTimeout.bind(undefined, onDoubleClick.bind(undefined), 200),
        })
        
        graph.show();
    });

/* 
// set the dimensions and margins of the graph
const margin = { top: 10, right: 30, bottom: 30, left: 40 };
const width = 400 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

// append the svg object to the body of the page
const svg = d3
        .select("#network")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

d3.json("assets/data_network.json")
        .then(function(data) {
                // Initialize the links
                const link = svg
                        .selectAll("line")
                        .data(data.links)
                        .join("line")
                        .style("stroke", "#aaa")

                // Initialize the nodes
                const node = svg
                        .selectAll("circle")
                        .data(data.nodes)
                        .join("circle")
                        .attr("r", 10)
                        .style("fill", "#69b3a2")

                // Let's list the force we wanna apply on the network
                const simulation = d3
                        // Force algorithm is applied to data.nodes
                        .forceSimulation(data.nodes)
                        // This force provides links between nodes
                        .force(
                                "link",
                                d3.forceLink()
                                        // This provide the id of a node
                                        .id(function(d) { return d.id; })
                                        // and this the list of links
                                        .links(data.links)
                        )
                        // This adds repulsion between nodes. Play with the -400 for the repulsion strength
                        .force("charge", d3.forceManyBody().strength(-400.0))
                        // This force attracts nodes to the center of the svg area
                        .force("center", d3.forceCenter(width / 2.0, height / 2.0))
                        .on("tick", ticked);

                // This function is run at each iteration of the force algorithm, updating the nodes position.
                function ticked() {
                        link
                                .attr("x1", function(d) { return d.source.x; })
                                .attr("y1", function(d) { return d.source.y; })
                                .attr("x2", function(d) { return d.target.x; })
                                .attr("y2", function(d) { return d.target.y; });

                        node
                                .attr("cx", function(d) { return d.x; })
                                .attr("cy", function(d) { return d.y; });
                }
        });
 */