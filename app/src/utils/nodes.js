/**
 * PicMachina — Node Utilities
 *
 * Shared logic for tree traversal, flattening, and counting of recipe nodes.
 */

/**
 * Flattens a recursive node tree into a linear list for rendering.
 * Each item contains: { node, depth, isBranchHeader, path }
 * 'path' is an array of { nodes, index } tracking the location in the tree.
 */
export function flattenNodes(nodes = [], depth = 0, path = []) {
  let items = [];
  if (!nodes) return items;

  nodes.forEach((node, index) => {
    const currentPath = [...path, { nodes, index }];
    items.push({ node, depth, isBranchHeader: false, path: currentPath });

    // Handle Branch nodes
    if (node.type === 'branch' && node.branches) {
      node.branches.forEach((branch, bIdx) => {
        const branchPath = [...currentPath, { branch, nodes: branch.nodes }];
        items.push({
          node: {
            id: branch.id || `header-${node.id}-${bIdx}`,
            type: '_branch_header',
            label: branch.label || `Variant ${String.fromCharCode(65 + bIdx)}`,
            parentId: node.id,
            branchIdx: bIdx
          },
          depth: depth + 1,
          isBranchHeader: true,
          path: branchPath
        });
        items.push(...flattenNodes(branch.nodes, depth + 2, branchPath));
      });
    }

    // Handle Conditional nodes
    if (node.type === 'conditional') {
      if (node.thenNodes) {
        const thenPath = [...currentPath, { nodes: node.thenNodes, field: 'thenNodes' }];
        items.push({
          node: { id: `then-${node.id}`, type: '_branch_header', label: 'Then', parentId: node.id },
          depth: depth + 1,
          isBranchHeader: true,
          path: thenPath
        });
        items.push(...flattenNodes(node.thenNodes, depth + 2, thenPath));
      }
      if (node.elseNodes) {
        const elsePath = [...currentPath, { nodes: node.elseNodes, field: 'elseNodes' }];
        items.push({
          node: { id: `else-${node.id}`, type: '_branch_header', label: 'Else', parentId: node.id },
          depth: depth + 1,
          isBranchHeader: true,
          path: elsePath
        });
        items.push(...flattenNodes(node.elseNodes, depth + 2, elsePath));
      }
    }
  });

  return items;
}

/**
 * Recursively counts all nodes in a tree (excluding branch headers).
 */
export function countNodes(nodes = []) {
  let count = 0;
  if (!nodes) return 0;
  nodes.forEach(n => {
    count++;
    if (n.branches) n.branches.forEach(b => { count += countNodes(b.nodes); });
    if (n.thenNodes) count += countNodes(n.thenNodes);
    if (n.elseNodes) count += countNodes(n.elseNodes);
  });
  return count;
}

/**
 * Finds a node by ID in the tree and returns its parent array and index.
 */
export function findNodeAndParent(nodes, nodeId) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === nodeId) return { parent: nodes, index: i, node: n };

    if (n.branches) {
      for (const b of n.branches) {
        const found = findNodeAndParent(b.nodes, nodeId);
        if (found) return found;
      }
    }
    if (n.thenNodes) {
      const found = findNodeAndParent(n.thenNodes, nodeId);
      if (found) return found;
    }
    if (n.elseNodes) {
      const found = findNodeAndParent(n.elseNodes, nodeId);
      if (found) return found;
    }
  }
  return null;
}
