/*
 * https://github.com/xzitlou/jsontr.ee - MIT License
 * Generates an SVG visualization of a JSON object as a tree.
 */

interface NodeSize {
    width: number;
    height: number;
    lines: Array<{ key: string, value: string }>;
}

interface Position {
    x: number;
    y: number;
    width: number;
    height: number;
}

function generateJSONTree(json: any): string {
    // Basic layout configuration
    const padding = 10; // Internal spacing of nodes
    const lineHeight = 18; // Line height for text within nodes
    const fontSize = 12; // Font size
    const fontFamily = "monospace"; // Font family for text
    let svgContent: string[] = []; // Stores SVG elements representing nodes
    let edges: string[] = []; // Stores lines connecting nodes
    let nodeId = 0; // Counter to assign unique ID to each node
    let maxX = 0; // Maximum X coordinate of the SVG
    let maxY = 0; // Maximum Y coordinate of the SVG
    const occupiedPositions: [number, number, number, number][] = []; // Tracks occupied positions to avoid overlap

    /**
     * Measures the width of a text based on font settings.
     * @param text - Text to measure.
     * @returns Width of the text in pixels.
     */
    function measureTextWidth(text: string): number {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context) {
            context.font = `${fontSize}px ${fontFamily}`;
            return context.measureText(text).width;
        }
        return 0;
    }

    /**
     * Calculates the size of a node based on its content.
     * @param obj - JSON object or value to visualize.
     * @returns Dimensions (width, height) and text lines of the node.
     */
    function calculateNodeSize(obj: any): NodeSize {
        const lines: Array<{ key: string, value: string }> = []; // Stores text lines of the node

        // Determine text lines based on data type
        if (Array.isArray(obj)) {
            lines.push({ key: "", value: `Array (${obj.length})` });
        } else if (typeof obj === "object" && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                const displayValue = Array.isArray(value)
                    ? `Array (${value.length})`
                    : typeof value === "object"
                    ? "{}"
                    : JSON.stringify(value);
                lines.push({ key, value: displayValue });
            }
        } else {
            lines.push({ key: "", value: JSON.stringify(obj) });
        }

        // Calculate node width and height based on text lines
        const maxWidth = Math.max(...lines.map(line => measureTextWidth(`${line.key}: ${line.value}`)));
        const height = lines.length * lineHeight + padding * 2;

        return { width: maxWidth + padding * 2, height, lines };
    }

    /**
     * Adjusts the position of a node to avoid overlap with other nodes.
     * @param x - Initial X coordinate.
     * @param y - Initial Y coordinate.
     * @param width - Node width.
     * @param height - Node height.
     * @returns Adjusted Y coordinate.
     */
    function adjustPosition(x: number, y: number, width: number, height: number): number {
        let adjustedY = y;
        const buffer = 10; // Spacing between nodes to avoid collisions

        for (const pos of occupiedPositions) {
            const [ox, oy, ow, oh] = pos;
            if (
                x < ox + ow &&
                x + width > ox &&
                adjustedY < oy + oh &&
                adjustedY + height > oy
            ) {
                adjustedY = oy + oh + buffer; // Adjust downwards if there is a collision
            }
        }

        // Register the position as occupied
        occupiedPositions.push([x, adjustedY, width, height]);

        return adjustedY;
    }

    /**
     * Recursively builds the tree from the JSON and generates nodes and connections.
     * @param obj - JSON object or value to visualize.
     * @param x - X coordinate of the current node.
     * @param y - Y coordinate of the current node.
     * @param parentId - ID of the parent node (if any).
     * @param parentPosition - Position of the parent node (if any).
     */
    function buildTree(obj: any, x: number, y: number, parentId: string | null = null, parentPosition: Position | null = null): void {
        const { width, height, lines } = calculateNodeSize(obj);
        const adjustedY = adjustPosition(x, y, width, height);
        const currentId = `node-${nodeId++}`; // Unique ID for the current node

        // Generate the node content using flexbox for alignment
        const nodeContent = lines
            .map(line => `
                <div style="display: flex;">
                    <span class="json-key" style="margin-right: 5px;">${line.key ? `${line.key}:` : ""}</span>
                    <span class="json-value">${line.value}</span>
                </div>
            `)
            .join("");

        // Add the node to the SVG content
        svgContent.push(`
            <g id="${currentId}" transform="translate(${x}, ${adjustedY})">
                <rect width="${width}" height="${height}" rx="5" ry="5" style="fill:#f6f8fa;stroke:#475872;stroke-width:1"></rect>
                <foreignObject width="${width}" height="${height}">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${fontFamily}; font-size:${fontSize}px; line-height:${lineHeight}px; padding:${padding}px; box-sizing:border-box;">
                        ${nodeContent}
                    </div>
                </foreignObject>
            </g>
        `);

        // If the node has a parent, draw a connection (curved line)
        if (parentId && parentPosition) {
            const parentCenterX = parentPosition.x + parentPosition.width / 2;
            const parentCenterY = parentPosition.y + parentPosition.height / 2;
            const childCenterX = x;
            const childCenterY = adjustedY + height / 2;

            edges.push(`
                <path d="M${parentCenterX},${parentCenterY} C${(parentCenterX + childCenterX) / 2},${parentCenterY} ${(parentCenterX + childCenterX) / 2},${childCenterY} ${childCenterX},${childCenterY}"
                      style="fill:none;stroke:#475872;stroke-width:1;marker-end:url(#arrowhead);" />
            `);
        }

        let nextYOffset = adjustedY;

        // Process the children of the current node
        lines.forEach(line => {
            const value = (obj as any)[line.key];
            const childX = x + width + 100;

            if (Array.isArray(value)) {
                const listNode = { [`${line.key} (${value.length})`]: "Array" };
                buildTree(listNode, childX, nextYOffset, currentId, { x, y: adjustedY, width, height });

                value.forEach((item, index) => {
                    const childY = nextYOffset + index * (lineHeight + 30);
                    buildTree(item, childX + calculateNodeSize(listNode).width + 100, childY, `node-${nodeId - 1}`, {
                        x: childX,
                        y: nextYOffset,
                        width: calculateNodeSize(listNode).width,
                        height: calculateNodeSize(listNode).height,
                    });
                });

                nextYOffset += value.length * (lineHeight + 30) + 50;
            } else if (typeof value === "object" && value !== null) {
                buildTree(value, childX, nextYOffset, currentId, { x, y: adjustedY, width, height });
                nextYOffset += calculateNodeSize(value).height + 50;
            }
        });

        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, nextYOffset);
    }

    // Start building the tree from the root node
    buildTree(json, 50, 50);

    // Generate the final SVG
    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${maxX + 150}" height="${maxY + 150}">
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" style="fill:#475872;" />
                </marker>
            </defs>
            ${edges.join("")}
            ${svgContent.join("")}
        </svg>
    `;
}
