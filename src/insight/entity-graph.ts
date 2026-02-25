/**
 * Entity Graph — Mentat Monitor Insight Layer
 *
 * In-memory graph with typed traversal:
 *  - getAffectedAssets(entityId)   → assets reachable via 'affects' edges
 *  - getAffectedSectors(entityId)  → sectors reachable via 'belongs_to_sector'
 *  - findByTags(tags[])            → entity search
 *  - traverse(entityId, edgeTypes, maxDepth) → BFS traversal
 *  - getImpactChain(triggerEntityId) → ordered list of downstream impacts
 */

import { SEED_ENTITIES, SEED_EDGES } from './entity-seed.js';
import type { Entity, Edge, EdgeType, EntityType } from './types.js';

interface TraversalNode {
  entityId: string;
  depth: number;
  cumulativeWeight: number;
  path: string[];          // entity IDs from root to this node
  edge?: Edge;             // edge that led here
}

interface ImpactChainItem {
  entityId: string;
  entity: Entity | undefined;
  depth: number;
  weight: number;
  edgeType: EdgeType;
  direction?: string;      // from edge meta
}

export class EntityGraph {
  private entities: Map<string, Entity>;
  private edges: Edge[];
  /** Forward adjacency: entityId → list of outgoing neighbors */
  private adjacency: Map<string, Array<{ entityId: string; edge: Edge }>>;
  /** Reverse adjacency: entityId → list of incoming neighbors */
  private reverseAdjacency: Map<string, Array<{ entityId: string; edge: Edge }>>;

  constructor(entities: Entity[], edges: Edge[]) {
    this.entities = new Map(entities.map(e => [e.id, e]));
    this.edges = edges;
    this.adjacency = new Map();
    this.reverseAdjacency = new Map();

    // Pre-build adjacency maps
    for (const edge of edges) {
      if (!this.adjacency.has(edge.from)) this.adjacency.set(edge.from, []);
      this.adjacency.get(edge.from)!.push({ entityId: edge.to, edge });

      if (!this.reverseAdjacency.has(edge.to)) this.reverseAdjacency.set(edge.to, []);
      this.reverseAdjacency.get(edge.to)!.push({ entityId: edge.from, edge });

      // Bidirectional edges
      if (edge.directional === false) {
        if (!this.adjacency.has(edge.to)) this.adjacency.set(edge.to, []);
        this.adjacency.get(edge.to)!.push({ entityId: edge.from, edge });
      }
    }
  }

  // ─── Entity access ──────────────────────────────────────────────────────────

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  getEntityKo(id: string): string {
    return this.entities.get(id)?.nameKo ?? id.split(':')[1] ?? id;
  }

  hasEntity(id: string): boolean {
    return this.entities.has(id);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  getEntitiesByType(type: EntityType): Entity[] {
    return Array.from(this.entities.values()).filter(e => e.type === type);
  }

  /** Find entities by tag match (case-insensitive, partial) */
  findByTags(tags: string[]): Entity[] {
    const lower = tags.map(t => t.toLowerCase());
    return Array.from(this.entities.values()).filter(e =>
      lower.some(t => e.tags.some(et => et.toLowerCase().includes(t) || t.includes(et.toLowerCase())))
    );
  }

  // ─── Neighbor access ────────────────────────────────────────────────────────

  getNeighbors(entityId: string, edgeTypes?: EdgeType[]): Array<{ entityId: string; edge: Edge }> {
    const neighbors = this.adjacency.get(entityId) ?? [];
    if (!edgeTypes) return neighbors;
    return neighbors.filter(n => edgeTypes.includes(n.edge.type));
  }

  getReverseNeighbors(entityId: string, edgeTypes?: EdgeType[]): Array<{ entityId: string; edge: Edge }> {
    const neighbors = this.reverseAdjacency.get(entityId) ?? [];
    if (!edgeTypes) return neighbors;
    return neighbors.filter(n => edgeTypes.includes(n.edge.type));
  }

  // ─── BFS Traversal ──────────────────────────────────────────────────────────

  /**
   * BFS from startEntityId, following given edge types.
   * Returns nodes sorted by depth then cumulativeWeight.
   * @param minWeight Only follow edges with weight >= minWeight
   * @param maxDepth Maximum hops (default 2)
   */
  traverse(
    startEntityId: string,
    edgeTypes: EdgeType[],
    maxDepth = 2,
    minWeight = 0.4,
  ): TraversalNode[] {
    const visited = new Set<string>([startEntityId]);
    const queue: TraversalNode[] = [{
      entityId: startEntityId,
      depth: 0,
      cumulativeWeight: 1.0,
      path: [startEntityId],
    }];
    const results: TraversalNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > 0) results.push(current); // don't include start node

      if (current.depth >= maxDepth) continue;

      const neighbors = this.getNeighbors(current.entityId, edgeTypes);
      for (const { entityId, edge } of neighbors) {
        if (visited.has(entityId)) continue;
        if (edge.weight < minWeight) continue;

        visited.add(entityId);
        queue.push({
          entityId,
          depth: current.depth + 1,
          cumulativeWeight: current.cumulativeWeight * edge.weight,
          path: [...current.path, entityId],
          edge,
        });
      }
    }

    return results.sort((a, b) => b.cumulativeWeight - a.cumulativeWeight);
  }

  // ─── Semantic traversal helpers ──────────────────────────────────────────────

  /**
   * Get all assets affected by an entity (direct + 1-hop via sectors/companies)
   * Key improvement over Opus spec: uses graph traversal, not hardcoded lists
   */
  getAffectedAssets(entityId: string, maxDepth = 2): Array<{ assetId: string; weight: number; direction?: string }> {
    const nodes = this.traverse(entityId, ['affects', 'belongs_to_sector', 'supply_chain_dependency'], maxDepth);
    return nodes
      .filter(n => {
        const e = this.entities.get(n.entityId);
        return e?.type === 'asset';
      })
      .map(n => ({
        assetId: n.entityId,
        weight: n.cumulativeWeight,
        direction: n.edge?.meta?.direction as string | undefined,
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get all sectors impacted by an entity via traversal
   */
  getAffectedSectors(entityId: string, maxDepth = 2): Array<{ sectorId: string; weight: number }> {
    const nodes = this.traverse(entityId, ['affects', 'supply_chain_dependency'], maxDepth);
    return nodes
      .filter(n => this.entities.get(n.entityId)?.type === 'sector')
      .map(n => ({ sectorId: n.entityId, weight: n.cumulativeWeight }))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get all companies in a sector (reverse lookup)
   */
  getCompaniesInSector(sectorId: string): Entity[] {
    const incoming = this.getReverseNeighbors(sectorId, ['belongs_to_sector']);
    return incoming
      .map(n => this.entities.get(n.entityId))
      .filter((e): e is Entity => !!e);
  }

  /**
   * Get full impact chain from a trigger entity:
   * trigger → (affects) → regions/countries → (affects) → assets/sectors
   * Useful for generating human-readable impact explanation
   */
  getImpactChain(triggerEntityId: string, maxDepth = 3, minWeight = 0.5): ImpactChainItem[] {
    const nodes = this.traverse(triggerEntityId, ['affects', 'located_in', 'belongs_to_sector', 'adversary_of'], maxDepth, minWeight);
    return nodes.map(n => ({
      entityId: n.entityId,
      entity: this.entities.get(n.entityId),
      depth: n.depth,
      weight: n.cumulativeWeight,
      edgeType: n.edge!.type,
      direction: n.edge?.meta?.direction as string | undefined,
    }));
  }

  /**
   * Find all entities that have adversarial relationships with a given country/entity
   */
  getAdversaries(entityId: string): Entity[] {
    const outgoing = this.getNeighbors(entityId, ['adversary_of']);
    const incoming = this.getReverseNeighbors(entityId, ['adversary_of']);
    return [...outgoing, ...incoming]
      .map(n => this.entities.get(n.entityId))
      .filter((e): e is Entity => !!e);
  }

  /**
   * Explain WHY an asset is affected by an event (for narrative generation)
   * Returns ordered explanation chain: event → intermediate → asset
   */
  explainImpact(fromEntityId: string, toAssetId: string): string[] {
    const chain = this.getImpactChain(fromEntityId);
    const path = chain.find(n => n.entityId === toAssetId);
    if (!path) return [fromEntityId, toAssetId];
    return path.entity ? [fromEntityId, ...path.entity.id.split(':'), toAssetId] : [fromEntityId, toAssetId];
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  stats(): { entities: number; edges: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const e of this.entities.values()) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
    }
    return { entities: this.entities.size, edges: this.edges.length, byType };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _graph: EntityGraph | null = null;

export function getEntityGraph(): EntityGraph {
  if (!_graph) {
    _graph = new EntityGraph(SEED_ENTITIES, SEED_EDGES);
  }
  return _graph;
}
