import uniqBy from 'lodash/uniqBy';
import { $$asyncIterator } from 'iterall';
import eventEmitterToAsyncIterator from '../asynciterators/eventEmitterToAsyncIterator';

const ISSUES_SOURCE = {
  __typename: 'Issues',
  id: 'Source:issues',
  name: 'Issues',
};
const PROCESS_SOURCE = {
  __typename: 'Process',
  id: 'Source:metro',
  name: 'Metro Bundler',
};
const DEFAULT_SOURCES = [ISSUES_SOURCE, PROCESS_SOURCE];

export default function createContext({ projectDir, messageBuffer, layout, issues }) {
  let flattenedMessages;
  return {
    getCurrentProject() {
      return {
        projectDir,
      };
    },
    getMessageIterator(cursor) {
      return messageBuffer.getIterator(cursor);
    },
    getMessageEdges(source) {
      if (!flattenedMessages) {
        flattenedMessages = flattenMessagesFromBuffer(messageBuffer);
      }

      if (!source) {
        return flattenedMessages;
      }

      switch (source.__typename) {
        case 'Issues':
          return issues.getIssueList();
        case 'Process':
          return flattenedMessages.filter(
            ({ node: message }) =>
              message.tag === 'metro' || message.tag === 'expo' || message.type === 'global'
          );
        case 'Device':
          return flattenedMessages.filter(
            ({ node: message }) => message.tag === 'device' && message.deviceId === source.id
          );
      }
    },
    getMessageConnection(source) {
      const edges = this.getMessageEdges(source);

      let unreadCount = 0;
      let lastReadCursor = null;
      if (source) {
        ({ unreadCount, lastReadCursor } = extractReadInfo(layout.get(), source.id, edges));
      }

      return {
        count: edges.length,
        unreadCount,
        edges,
        // on-demand mapping
        nodes: () => edges.map(({ node }) => node),
        pageInfo: {
          hasNextPage: false,
          lastReadCursor,
          lastCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
      };
    },
    getIssuesSource() {
      return ISSUES_SOURCE;
    },
    getProcessSource() {
      return PROCESS_SOURCE;
    },
    getSourceById(id) {
      const allSources = this.getSources();
      return allSources.find(source => source.id === id);
    },
    getSources() {
      const chunks = messageBuffer.all().filter(({ node }) => node.tag === 'device');
      const devices = uniqBy(chunks, ({ node }) => node.deviceId).map(({ node }) => ({
        __typename: 'Device',
        id: node.deviceId,
        name: node.deviceName,
      }));
      return DEFAULT_SOURCES.concat(devices);
    },
    getProjectManagerLayout() {
      return layout.get();
    },
    setProjectManagerLayout(newLayout) {
      newLayout.sources.forEach(sourceId => {
        this.setLastRead(sourceId);
      });
      layout.set(newLayout);
    },
    setLastRead(sourceId, lastReadCursor) {
      if (!lastReadCursor) {
        const source = this.getSourceById(sourceId);
        const edges = this.getMessageEdges(source);
        if (edges.length === 0) {
          return;
        } else {
          lastReadCursor = edges[edges.length - 1].cursor;
        }
      }
      layout.setLastRead(sourceId, lastReadCursor.toString());
    },
    getIssueIterator() {
      const iterator = eventEmitterToAsyncIterator(issues, ['ADDED', 'UPDATED', 'DELETED']);
      return {
        async next() {
          const { value, done } = await iterator.next();
          return {
            value: {
              type: value.eventName,
              node: value.event,
            },
            done,
          };
        },

        [$$asyncIterator]() {
          return this;
        },
      };
    },
  };
}

function flattenMessagesFromBuffer(buffer) {
  const items = buffer.allWithCursor();
  const itemsById = new Map();
  const flattenedItems = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const { cursor, item: { node } } = items[i];
    if (!itemsById.has(node.id)) {
      const element = { cursor, node };
      itemsById.set(node.id, element);
      flattenedItems.unshift(element);
    } else {
      itemsById.get(node.id).cursor = cursor;
    }
  }
  return flattenedItems;
}

function extractReadInfo(layout, sourceId, items) {
  let lastReadCursor = layout.sourceLastReads[sourceId];
  let unreadCount;
  if (!lastReadCursor) {
    lastReadCursor = items[0] && items[0].cursor;
    unreadCount = items.length;
  } else {
    const index = items.findIndex(({ cursor }) => cursor.toString() === lastReadCursor);
    unreadCount = items.length - index - 1;
  }
  return {
    lastReadCursor,
    unreadCount,
  };
}
