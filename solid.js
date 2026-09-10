import { createSignal, createEffect, For, flush } from 'solid-js';
import { createRenderer } from '@solidjs/universal';
import { ROW_COUNT, WRAPPER_COUNT } from './host.js';

function createHostRenderer(host) {
  return createRenderer({
    createElement: host.createNode,
    createTextNode() {
      throw new Error('No text nodes in this reproduction');
    },
    isTextNode: () => false,
    replaceText() {
      throw new Error('No text updates in this reproduction');
    },
    setProperty(node, name, value) {
      const isActiveUpdate = name === 'active'
        && node.props.active !== undefined
        && !Object.is(node.props.active, value);
      if (isActiveUpdate) host.counts.nativeUpdates++;
      host.setProperty(node, name, value);
    },
    insertNode: host.insertNode,
    removeNode: host.removeNode,
    getParentNode: node => node.parent,
    getFirstChild: node => node.children[0],
    getNextSibling(node) {
      const siblings = node.parent.children;
      return siblings[siblings.indexOf(node) + 1];
    },
  });
}

export function mount(host) {
  const renderer = createHostRenderer(host);

  function View(props) {
    host.counts.wrapperRenders++;
    createEffect(() => undefined, () => {
      host.counts.effectCreates++;
      return () => host.counts.effectCleanups++;
    });
    const node = renderer.createElement('view');
    renderer.setProp(node, 'style', props.style);
    renderer.insert(node, props.children);
    return node;
  }

  function Row(props) {
    host.counts.rowRenders++;
    const node = renderer.createElement('row');
    renderer.setProp(node, 'id', props.id);
    renderer.setProp(node, 'onHover', props.onHover);
    renderer.effect(
      () => props.active,
      active => {
        renderer.setProp(node, 'active', active);
      },
    );
    let content = node;
    for (let depth = 0; depth < WRAPPER_COUNT; depth++) {
      content = renderer.createComponent(View, {
        style: { padding: depth + 1 },
        children: content,
      });
    }
    return content;
  }

  function App() {
    host.counts.appRenders++;
    const [activeRow, setActiveRow] = createSignal(-1);
    const node = renderer.createElement('root');
    const rows = renderer.createComponent(For, {
      get each() {
        return Array.from({ length: ROW_COUNT }, (_, index) => index);
      },
      children: index => renderer.createComponent(Row, {
        id: index,
        get active() {
          return index === activeRow();
        },
        onHover: () => {
          host.counts.eventCalls++;
          setActiveRow(index);
        },
      }),
    });
    renderer.insert(node, rows);
    return node;
  }

  const dispose = renderer.render(() => renderer.createComponent(App, {}), host.container);
  flush();
  return {
    dispatch(node, payload) {
      node.events.get('hover')(payload);
    },
    flush,
    unmount() {
      dispose();
      for (const node of [...host.nodes.values()]) {
        host.destroyNode(node);
      }
      flush();
    },
  };
}
