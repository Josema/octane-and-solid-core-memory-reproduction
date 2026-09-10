export const ROW_COUNT = 20;
export const WRAPPER_COUNT = 4;
export const HOST_COUNT = 1 + ROW_COUNT * (WRAPPER_COUNT + 1);
export const EFFECT_COUNT = ROW_COUNT * WRAPPER_COUNT;

export function createHost() {
  const nodes = new Map();
  const container = { type: 'container', children: [], parent: null };
  const counts = {
    creates: 0, destroys: 0, nativeUpdates: 0, activeChanges: 0,
    styleChanges: 0, eventCalls: 0, appRenders: 0, rowRenders: 0,
    wrapperRenders: 0, effectCreates: 0, effectCleanups: 0,
  };
  let next_id = 0;
  let measuring = false;

  function createNode(type) {
    const node = { id: ++next_id, type, props: {}, events: new Map(), parent: null, children: [] };
    nodes.set(node.id, node);
    counts.creates++;
    return node;
  }

  function setProperty(node, name, value) {
    if (name === 'onHover') {
      if (value == null) node.events.delete('hover');
      else node.events.set('hover', value);
      return;
    }
    const previous = node.props[name];
    if (measuring && name === 'active' && !Object.is(value, previous)) counts.activeChanges++;
    if (measuring && name === 'style' && value.padding !== previous.padding) counts.styleChanges++;
    node.props[name] = value;
  }

  function applyProps(node, props) {
    for (const name of Object.keys(props)) setProperty(node, name, props[name]);
    for (const name of Object.keys(node.props)) if (!(name in props)) delete node.props[name];
  }

  function removeNode(parent, node) {
    const index = parent.children.indexOf(node);
    if (index < 0) throw new Error('Removing a node outside its parent');
    parent.children.splice(index, 1);
    node.parent = null;
  }

  function insertNode(parent, node, before = null) {
    if (node.parent !== null) removeNode(node.parent, node);
    const index = before === null ? parent.children.length : parent.children.indexOf(before);
    if (index < 0) throw new Error('Missing insertion anchor');
    parent.children.splice(index, 0, node);
    node.parent = parent;
  }

  function destroyNode(node) {
    if (!nodes.has(node.id)) throw new Error('Destroying a node twice');
    if (node.parent !== null) removeNode(node.parent, node);
    for (const child of node.children) child.parent = null;
    node.children.length = 0;
    node.events.clear();
    nodes.delete(node.id);
    counts.destroys++;
  }

  function validate(active_index, expected_rows) {
    if (nodes.size !== HOST_COUNT || container.children.length !== 1) throw new Error('Host count changed');
    const root = container.children[0];
    if (root.type !== 'root' || root.children.length !== ROW_COUNT) throw new Error('Root topology changed');
    const rows = [];
    for (let index = 0; index < ROW_COUNT; index++) {
      let node = root.children[index];
      for (let depth = 0; depth < WRAPPER_COUNT; depth++) {
        if (node.type !== 'view' || node.props.style.padding !== WRAPPER_COUNT - depth || node.children.length !== 1) throw new Error('Wrapper topology or padding changed');
        node = node.children[0];
      }
      if (node.type !== 'row' || node.props.id !== index || node.props.active !== (index === active_index) || node.children.length !== 0 || !node.events.has('hover')) throw new Error('Row props or hover listener differ');
      if (expected_rows && node !== expected_rows[index]) throw new Error('A row was recreated');
      rows.push(node);
    }
    return rows;
  }

  return { nodes, container, counts, createNode, setProperty, applyProps, removeNode, insertNode, destroyNode, validate, startMeasurement() { measuring = true; } };
}
