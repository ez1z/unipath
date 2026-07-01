export type EntityType = 'university' | 'scholarship';

export type DiscussionMessageDbRow = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  parent_id: string | null;
  user_id: string;
  author_label: string;
  body: string;
  score: number;
  is_deleted: boolean;
  created_at: string;
};

export type DiscussionMessage = {
  id: string;
  parentId: string | null;
  userId: string;
  authorLabel: string;
  body: string;
  score: number;
  isDeleted: boolean;
  createdAt: string;
  viewerVote: -1 | 0 | 1; // current viewer's vote on this message
  children: DiscussionMessage[];
};

export function dbRowToMessage(
  row: DiscussionMessageDbRow,
  viewerVote: -1 | 0 | 1 = 0,
): DiscussionMessage {
  return {
    id: row.id,
    parentId: row.parent_id,
    userId: row.user_id,
    authorLabel: row.author_label,
    body: row.is_deleted ? '' : row.body,
    score: row.score,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    viewerVote,
    children: [],
  };
}

/**
 * Assemble a flat list of rows into a nested tree, ordered by the given sort.
 * Deleted nodes are kept (rendered as "[removed]") so replies stay attached.
 */
export function buildTree(
  rows: DiscussionMessageDbRow[],
  votes: Map<string, -1 | 1>,
  sort: 'top' | 'new',
): DiscussionMessage[] {
  const nodes = new Map<string, DiscussionMessage>();
  for (const row of rows) {
    nodes.set(row.id, dbRowToMessage(row, votes.get(row.id) ?? 0));
  }
  const roots: DiscussionMessage[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const cmp =
    sort === 'top'
      ? (a: DiscussionMessage, b: DiscussionMessage) =>
          b.score - a.score || b.createdAt.localeCompare(a.createdAt)
      : (a: DiscussionMessage, b: DiscussionMessage) => b.createdAt.localeCompare(a.createdAt);
  const sortRec = (list: DiscussionMessage[]) => {
    list.sort(cmp);
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}
