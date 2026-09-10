import {
  createUniversalRoot,
  defineUniversalComponent,
  universalPlan,
  universalValue,
  universalComponent,
  universalFor,
  useState,
  useEffect,
} from 'octane/universal/native';
import { ROW_COUNT, WRAPPER_COUNT } from './host.js';

function createDriver(host) {
  const nodesById = new Map([[null, host.container]]);
  return {
    id: 'core-repro',
    capabilities: { text: 'host' },
    events: {
      classify(name) {
        if (name !== 'onHover') return null;
        return { type: 'hover', priority: 'continuous' };
      },
    },
    getPublicInstance(_container, id) {
      return nodesById.get(id);
    },
    prepareBatch(_container, { commands }) {
      return {
        apply() {
          for (const command of commands) {
            switch (command.op) {
              case 'create': {
                const node = host.createNode(command.type);
                host.applyProps(node, command.props);
                nodesById.set(command.id, node);
                break;
              }
              case 'update':
                host.counts.nativeUpdates++;
                host.applyProps(nodesById.get(command.id), command.props);
                break;
              case 'insert':
              case 'move': {
                const parent = nodesById.get(command.parent);
                const node = nodesById.get(command.id);
                const before = command.before === null ? null : nodesById.get(command.before);
                host.insertNode(parent, node, before);
                break;
              }
              case 'remove':
                host.removeNode(nodesById.get(command.parent), nodesById.get(command.id));
                break;
              case 'event': {
                const node = nodesById.get(command.id);
                if (command.listener === null) {
                  node.events.delete(command.type);
                } else {
                  node.events.set(command.type, command.listener.id);
                }
                break;
              }
              case 'destroy':
                host.destroyNode(nodesById.get(command.id));
                nodesById.delete(command.id);
                break;
              default:
                throw new Error('Unexpected command: ' + command.op);
            }
          }
        },
        abort() {},
      };
    },
  };
}

export function mount(host) {
  const driver = createDriver(host);
  const viewPlan = universalPlan(driver.id, {
    kind: 'host',
    type: 'view',
    bindings: [['style', 0]],
    children: [{ kind: 'slot', slot: 1 }],
  });
  const rowPlan = universalPlan(driver.id, {
    kind: 'host',
    type: 'row',
    bindings: [['id', 0], ['active', 1], ['onHover', 2]],
  });
  const rootPlan = universalPlan(driver.id, {
    kind: 'host',
    type: 'root',
    children: [{ kind: 'slot', slot: 0 }],
  });

  const View = defineUniversalComponent(driver.id, props => {
    host.counts.wrapperRenders++;
    useEffect(() => {
      host.counts.effectCreates++;
      return () => host.counts.effectCleanups++;
    }, []);
    return universalValue(viewPlan, [props.style, props.children]);
  });

  const Row = defineUniversalComponent(driver.id, props => {
    host.counts.rowRenders++;
    let content = universalValue(rowPlan, [props.id, props.active, props.onHover]);
    for (let depth = 0; depth < WRAPPER_COUNT; depth++) {
      content = universalComponent(driver.id, View, {
        style: { padding: depth + 1 },
        children: content,
      });
    }
    return content;
  });

  const App = defineUniversalComponent(driver.id, () => {
    host.counts.appRenders++;
    const [activeRow, setActiveRow] = useState(-1);
    const rows = universalFor(
      Array.from({ length: ROW_COUNT }, (_, index) => index),
      index => index,
      index => universalComponent(driver.id, Row, {
        id: index,
        active: index === activeRow,
        onHover: () => {
          host.counts.eventCalls++;
          setActiveRow(index);
        },
      }),
    );
    return universalValue(rootPlan, [rows]);
  });

  const root = createUniversalRoot({}, driver);
  root.render(App, {}).commitPassive();
  return {
    dispatch(node, payload) {
      root.dispatchEvent(node.events.get('hover'), payload);
    },
    flush() {
      root.flushScheduledWork();
      root.flushPassiveTasks();
    },
    unmount() {
      root.unmount();
      root.flushPassiveTasks();
    },
  };
}
