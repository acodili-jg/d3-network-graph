class Network {
    constructor() {
        this.availableId = 1;
        this.nodes = new Map();
        this.links = new ArrayKeyedMap();

        this.svg = d3
            .create('svg')
            .style('display', 'block');

        const transformed = this.svg.append('g');
        this.nodeSelection = transformed.selectAll('circle');
        this.linkSelection = transformed.selectAll('path');

        transformed
            .append('defs')
            .append('marker')
            .attr('id', 'arrow-head')
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', '6')
            .attr('markerHeight', '6')
            .attr('viewBox', '0 -2.5 5 5')
            .attr('refX', '5')
            .attr('refY', '0')
            .attr('fill', '#ffffff')
            .attr('orient', 'auto')
            .attr('stroke-width', 1)
            .append('path')
            .attr('d', `
                M 0, -2.5
                L 5,  0
                L 0,  2.5
            `);

        const zoom = d3
            .zoom()
            .scaleExtent([0.125, 16])
            // Prevent double click zoom on nodes.
            .filter(event => event.target.nodeName !== 'circle' || event.type !== 'dblclick')
            .on('zoom', event => {
                const { x, y, k } = event.transform;
                transformed.attr('transform', `translate(${x}, ${y}) scale(${k})`);
            });
        this.svg.call(zoom);

        this.simulation = d3
            .forceSimulation(this.nodes.values())
            .force(
                'link',
                d3.forceLink(this.links.values())
                    .distance(link => link.linkDistance || 100)
                    .id(node => node.id)
            )
            .force('collide', d3.forceCollide().radius(10))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('x', d3.forceX())
            .force('y', d3.forceY());

        new ResizeObserver(this.__on_resize.bind(this, zoom)).observe(this.svg.node());

        this.update();
    }

    __on_resize(zoom, entries) {
        const { width, height } = entries[0].contentRect;
        this.svg.attr('viewBox', [-width / 2, -height / 2, width, height]);
        zoom.extent([[0, 0], [width, height]]);
    }

    addNode(node) {
        const source = this.__add_node(node);
        this.update();
        return this.__node_wrapper(source);
    }

    __add_node(node) {
        const {
            id = `ns${this.availableId++}`,
            x = 0.0,
            y = 0.0,
            r,
            color,
            init,
        } = node || {};

        const source = { id, x, y, r, color, init };
        source.links = new Set();
        source.backlinks = new Set();
        this.nodes.set(id, source);

        return source;
    }

    getNode(id) {
        return this.__node_wrapper(this.nodes.get(id));
    }

    __node_wrapper(source) {
        const network = this;
        const wrapper = {
            __node__: source
        };

        wrapper.id = function(id) {
            if (!arguments.length) {
                return source.id;
            }

            network.nodes.remove(source.id);
            network.nodes.set(id, source);

            source.links.forEach(other_id => {
                const link = this.links.get([source.id, other_id]);
                this.links.delete(key);
                this.links.set([id, other_id], value);
                link.target.backlinks.delete(source.id);
                link.target.backlinks.add(id);
            });
            source.backlinks.forEach(id => {
                const link = this.links.get([other_id, source.id]);
                this.links.remove(key);
                this.links.set([other_id, id], value);
                link.source.links.delete(source.id);
                link.source.links.add(id);
            });

            source.id = id;

            network.update();
            return this;
        };

        wrapper.x = function(x) {
            if (!arguments.length) {
                return source.x;
            }

            source.x = x;
            network.update();
            return this;
        }

        wrapper.y = function(y) {
            if (!arguments.length) {
                return source.y;
            }

            source.y = y;
            network.update();
            return this;
        }

        wrapper.r = function(r) {
            if (!arguments.length) {
                return source.y;
            }

            source.r = r;
            network.update();
            return this;
        }

        wrapper.color = function(color) {
            if (!arguments.length) {
                return source.color;
            }

            source.color = color;
            network.update();
            return this;
        }

        wrapper.init = function(init) {
            if (!arguments.length) {
                return source.init;
            }

            source.init = init;
            network.update();
            return this;
        }

        wrapper.add = function(node) {
            node ||= {};
            node.x ||= source.x;
            node.y ||= source.y;
            node.r ||= source.r;
            node.color ||= source.color;
            node.init ||= source.init;
            const target = network.__add_node(node);

            this.link(target);
            // source.links.add(target.id);
            // target.backlinks.add(source.id);
            // network.links.set([source.id, target.id], { source, target });

            network.update();
            return network.__node_wrapper(target);
        }

        wrapper.link = function(target) {
            target = target?.__node__ || target;
            if (!target) {
                const id = target?.id;
                target = network.nodes.get(id);
                if (!target) {
                    throw `node with id ${id} is not in this network`;
                }
            }

            source.links.add(target.id);
            target.backlinks.add(source.id);
            network.links.set([source.id, target.id], { source, target });

            network.update();
            return this;
        };

        return wrapper;
    }

    appendTo(selection) {
        if (selection === undefined) {
            throw 'selection cannot be undefined';
        }
        if (typeof selection.select !== 'function') {
            selection = d3.select(selection);
        }
        if (selection.empty()) {
            throw 'empty selection';
        }

        selection.append(_ => this.svg.node());
        return this;
    }

    attr(_) {
        this.svg.attr.apply(this.svg, arguments);
        return this;
    }

    classed(_) {
        this.svg.classed.apply(this.svg, arguments);
        return this;
    }

    lower(_) {
        this.svg.lower.apply(this.svg, arguments);
    }

    remove(_) {
        this.svg.remove.apply(this.svg, arguments);
    }

    property(_) {
        this.svg.property.apply(this.svg, arguments);
        return this;
    }

    raise(_) {
        this.svg.raise.apply(this.svg, arguments);
    }

    style(_) {
        this.svg.style.apply(this.svg, arguments);
        return this;
    }

    update() {
        const network = this;
        const nodeSelection = this
            .nodeSelection
            .data(this.nodes.values(), node => node.id)
            .enter()
            .append('circle')
            .attr('id', node => node.id)
            .attr('fill', node => node.color || '#ffffff')
            .attr('r', node => node.r || 10.0)
            .merge(this.nodeSelection)
            .call(this.__drag_handler(this.simulation))
            .each(function(node) {
                const wrapper = network.__node_wrapper(node);
                typeof node.init === 'function' && node.init.apply(wrapper, [d3.select(this), wrapper]);
            });
        nodeSelection.append('title').text(node => node.id);
        this.nodeSelection = nodeSelection;

        const linkSelection = this
            .linkSelection
            .data(this.links.values())
            .enter()
            .append('path')
            .attr('stroke-width', 1)
            // .attr('id', link => `link_${link.id}`)
            .attr('stroke', link => link.color || '#ffffff')
            .attr('marker-end', 'url(#arrow-head)')
            .merge(this.linkSelection);
        this.linkSelection = linkSelection;

        // The following value collections MUST be converted to an array.
        this.simulation.nodes(Array.from(this.nodes.values()));
        this.simulation.force('link').links(Array.from(this.links.values()));

        this.simulation.on('tick', () => {
            nodeSelection.attr('cx', node => node.x).attr('cy', node => node.y);
            linkSelection.attr('d', link => this.__link_path(link)).attr('fill-opacity', '0');
        });
    }

    __drag_handler(simulation) {
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

    __link_path(link) {
        // It's bidirectional if there's the same link but reversed.
        const bidirectional = this.links.has([link.target.id, link.source.id]);
        // TODO: consider extracting as class constant
        const arrow_head_length = 5;

        const x1 = parseFloat(link.source.x);
        const y1 = parseFloat(link.source.y);
        // Accomodate arrow head if bidirectional.
        let start_offset = parseFloat(link.source.r || 10) + arrow_head_length * bidirectional;

        const x2 = parseFloat(link.target.x);
        const y2 = parseFloat(link.target.y);
        // Accomodate arrow head.
        const end_offset = parseFloat(link.target.r || 10) + arrow_head_length;

        // Get the direction vector.
        let direction_x = x2 - x1;
        let direction_y = y2 - y1;

        const normal_magnitude = Math.hypot(direction_x, direction_y);

        // Don't render when too close to nodes.
        if (normal_magnitude <= start_offset + end_offset) {
            return '';
        }

        // Normalize direction vector
        direction_x /= normal_magnitude;
        direction_y /= normal_magnitude;

        // Trim parts inside circles.
        const start_x = x1 + direction_x * start_offset;
        const start_y = y1 + direction_y * start_offset;
        const end_x = x2 - direction_x * end_offset;
        const end_y = y2 - direction_y * end_offset;
        const arrow_head_x = end_x + direction_x * arrow_head_length;
        const arrow_head_y = end_y + direction_y * arrow_head_length;

        if (bidirectional) {
            const middle_x = (start_x + end_x) / 2;
            const middle_y = (start_y + end_y) / 2;

            const normal_x = direction_y;
            const normal_y = -direction_x;
            
            const curve_factor = 10;
            const pivot_x = middle_x + normal_x * curve_factor;
            const pivot_y = middle_y + normal_y * curve_factor;

            // Curved line
            return `
                M ${start_x}, ${start_y}
                Q ${pivot_x} ${pivot_y}, ${end_x} ${end_y}
                M ${arrow_head_x}, ${arrow_head_y}
            `;
        } else {
            // Straight line
            return `
                M ${start_x}, ${start_y}
                L ${end_x}, ${end_y}
                M ${arrow_head_x}, ${arrow_head_y}
            `;
        }
    }
}

const network = new Network()
    .attr('id', 'main-network')
    .appendTo(document.body);
const n1 = network.addNode({
    init: (selection, node) => selection.on('click', event => {
        if (event.detail === 2) {
            setTimeout(() => node.add(), 200);
        }
    }),
});
const n3 = n1.add().add().link(n1);

n1.link(n3);
n1.link(n3);
