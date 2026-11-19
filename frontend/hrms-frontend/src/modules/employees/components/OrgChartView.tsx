"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Users,
  Building2,
  MapPin,
  Layers,
  ArrowLeft,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { Button, Avatar, StatusBadge } from '@hryantra/ui'
import { api } from '@/shared/api'
import { OrgChartNode, OrgChartResponse } from '../types'

// Color map for departments to make cards visually distinguishable
const DEPT_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Engineering: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', accent: '#6366f1' },
  Product: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: '#10b981' },
  Finance: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: '#f59e0b' },
  Sales: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', accent: '#0284c7' },
  Marketing: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', accent: '#ec4899' },
  HR: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', accent: '#a855f7' },
  Operations: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', accent: '#14b8a6' },
}

const DEFAULT_DEPT_COLOR = {
  bg: 'bg-slate-50',
  text: 'text-slate-700',
  border: 'border-slate-200',
  accent: '#64748b',
}

interface OrgChartNodeCardProps {
  node: OrgChartNode
  isExpanded: boolean
  onToggleExpand: (nodeId: string) => void
  onFocusTeam: (nodeId: string) => void
  searchQuery: string
  selectedDept: string
}

function OrgChartNodeCard({
  node,
  isExpanded,
  onToggleExpand,
  onFocusTeam,
  searchQuery,
  selectedDept,
}: OrgChartNodeCardProps) {
  const router = useRouter()
  const deptStyle = DEPT_COLORS[node.department] || DEFAULT_DEPT_COLOR

  const isMatchedSearch =
    searchQuery.trim() !== '' &&
    (node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.department.toLowerCase().includes(searchQuery.toLowerCase()))

  const isMatchedDept = !selectedDept || node.department === selectedDept

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative flex flex-col w-[260px] bg-white rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md ${
          isMatchedSearch
            ? 'ring-2 ring-indigo-500 border-indigo-400 shadow-indigo-100 scale-105'
            : !isMatchedDept && selectedDept
            ? 'opacity-40 border-slate-200'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Top Accent Strip */}
        <div
          className="h-1.5 w-full rounded-t-xl"
          style={{ backgroundColor: deptStyle.accent }}
        />

        <div className="p-3.5 flex flex-col gap-2.5">
          {/* Header: Avatar, Name, Employee ID */}
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              {node.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={node.avatar}
                  alt={node.name}
                  className="size-11 rounded-full object-cover border-2 border-white shadow-sm"
                />
              ) : (
                <Avatar
                  initials={node.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                  size="md"
                  gradient="indigo"
                />
              )}
              <span
                className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white ${
                  node.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
                title={`Status: ${node.status}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold text-slate-900 truncate" title={node.name}>
                  {node.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 font-medium">
                  {node.employeeId}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-600 truncate mt-0.5" title={node.designation}>
                {node.designation}
              </p>
            </div>
          </div>

          {/* Department & Location Badges */}
          <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-slate-100">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${deptStyle.bg} ${deptStyle.text} border ${deptStyle.border}`}
            >
              <Building2 className="size-2.5" />
              {node.department}
            </span>

            {node.locationName ? (
              <span className="inline-flex items-center gap-1 text-slate-500 text-[10px] truncate max-w-[100px]" title={node.locationName}>
                <MapPin className="size-2.5 shrink-0" />
                <span className="truncate">{node.locationName}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium">HQ</span>
            )}
          </div>

          {/* Actions & Report Count Bar */}
          <div className="flex items-center justify-between pt-1 text-[11px]">
            {node.directReportsCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 text-[11px]">
                <Users className="size-3 text-indigo-600" />
                <span>
                  {node.directReportsCount} {node.directReportsCount === 1 ? 'report' : 'reports'}
                </span>
                {node.totalDescendantsCount > node.directReportsCount && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({node.totalDescendantsCount} team)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Individual Contributor</span>
            )}

            <div className="flex items-center gap-1">
              {node.directReportsCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFocusTeam(node.id)
                  }}
                  title="Focus on this team as root"
                  className="px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                >
                  Focus
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/employees/${node.id}`)
                }}
                title="View full employee profile"
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              >
                <ExternalLink className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expand/Collapse Toggle Button for nodes with children */}
      {node.children && node.children.length > 0 && (
        <div className="relative z-10 flex flex-col items-center">
          {/* Vertical stem from card to toggle button */}
          <div className="w-[2px] h-4 bg-slate-300" />

          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className={`flex items-center justify-center size-6 rounded-full border shadow-sm transition-all text-xs font-bold ${
              isExpanded
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 scale-105 ring-2 ring-indigo-200'
            }`}
            title={isExpanded ? 'Collapse team' : `Expand team (${node.children.length})`}
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <span className="text-[10px]">+{node.children.length}</span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

interface TreeNodeRendererProps {
  node: OrgChartNode
  expandedIds: Set<string>
  onToggleExpand: (nodeId: string) => void
  onFocusTeam: (nodeId: string) => void
  searchQuery: string
  selectedDept: string
}

function TreeNodeRenderer({
  node,
  expandedIds,
  onToggleExpand,
  onFocusTeam,
  searchQuery,
  selectedDept,
}: TreeNodeRendererProps) {
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="flex flex-col items-center">
      <OrgChartNodeCard
        node={node}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onFocusTeam={onFocusTeam}
        searchQuery={searchQuery}
        selectedDept={selectedDept}
      />

      {/* Render Children Branches */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col items-center w-full">
          {/* Vertical stem from toggle button down to horizontal branch bar */}
          <div className="w-[2px] h-6 bg-slate-300" />

          {/* Children container with connecting lines */}
          <div className="relative flex items-start justify-center pt-2">
            {node.children.length > 1 && (
              /* Horizontal branch line connecting all children */
              <div
                className="absolute top-0 h-[2px] bg-slate-300"
                style={{
                  left: `calc(130px)`,
                  right: `calc(130px)`,
                }}
              />
            )}

            <div className="flex items-start gap-8 px-4">
              {node.children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  {/* Vertical drop line from horizontal branch down to child card */}
                  <div className="w-[2px] h-6 bg-slate-300 -mt-2 mb-0" />
                  <TreeNodeRenderer
                    node={child}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    onFocusTeam={onFocusTeam}
                    searchQuery={searchQuery}
                    selectedDept={selectedDept}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function OrgChartView() {
  const [data, setData] = React.useState<OrgChartResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Interactive controls
  const [zoomLevel, setZoomLevel] = React.useState(1)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedDept, setSelectedDept] = React.useState('')
  const [focusedRootId, setFocusedRootId] = React.useState<string | null>(null)
  const [focusedEmployeeName, setFocusedEmployeeName] = React.useState<string | null>(null)
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())

  // Load Tree Data
  const loadTree = React.useCallback(async (rootId?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await api.employees.getOrgChartTree(rootId ? { rootEmployeeId: rootId } : undefined)
      if (res?.success && res.data) {
        setData(res.data)
        // Auto expand all nodes up to 2 levels by default
        const initialExpanded = new Set<string>()
        const collectIds = (nodes: OrgChartNode[], depth: number) => {
          for (const n of nodes) {
            if (depth <= 2) {
              initialExpanded.add(n.id)
            }
            if (n.children && n.children.length > 0) {
              collectIds(n.children, depth + 1)
            }
          }
        }
        collectIds(res.data.roots, 1)
        setExpandedIds(initialExpanded)
      } else {
        setError(res?.message || 'Failed to load organization hierarchy')
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading org chart')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadTree(focusedRootId || undefined)
  }, [loadTree, focusedRootId])

  // Toggle expand / collapse single node
  const handleToggleExpand = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  // Expand all nodes
  const handleExpandAll = () => {
    if (!data) return
    const allIds = new Set<string>()
    const traverse = (nodes: OrgChartNode[]) => {
      for (const n of nodes) {
        allIds.add(n.id)
        if (n.children) traverse(n.children)
      }
    }
    traverse(data.roots)
    setExpandedIds(allIds)
  }

  // Collapse all nodes
  const handleCollapseAll = () => {
    setExpandedIds(new Set())
  }

  // Subtree focus
  const handleFocusTeam = (nodeId: string) => {
    const findNodeName = (nodes: OrgChartNode[]): string | null => {
      for (const n of nodes) {
        if (n.id === nodeId) return n.name
        if (n.children) {
          const found = findNodeName(n.children)
          if (found) return found
        }
      }
      return null
    }

    const name = data ? findNodeName(data.roots) : 'Selected Manager'
    setFocusedRootId(nodeId)
    setFocusedEmployeeName(name)
  }

  const handleResetToFullTree = () => {
    setFocusedRootId(null)
    setFocusedEmployeeName(null)
  }

  // Auto-expand ancestors when searching
  React.useEffect(() => {
    if (!searchQuery.trim() || !data) return
    const matchedAncestorIds = new Set<string>()

    const searchTraverse = (nodes: OrgChartNode[], path: string[]): boolean => {
      let anyMatchInSubtree = false
      for (const n of nodes) {
        const isSelfMatch =
          n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.employeeId.toLowerCase().includes(searchQuery.toLowerCase())

        const currentPath = [...path, n.id]
        let childMatched = false

        if (n.children && n.children.length > 0) {
          childMatched = searchTraverse(n.children, currentPath)
        }

        if (isSelfMatch || childMatched) {
          anyMatchInSubtree = true
          for (const pid of path) {
            matchedAncestorIds.add(pid)
          }
          if (isSelfMatch) {
            matchedAncestorIds.add(n.id)
          }
        }
      }
      return anyMatchInSubtree
    }

    searchTraverse(data.roots, [])
    if (matchedAncestorIds.size > 0) {
      setExpandedIds((prev) => new Set([...prev, ...matchedAncestorIds]))
    }
  }, [searchQuery, data])

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/60 rounded-xl border border-slate-200 overflow-hidden">
      {/* ── Toolbar & Filters Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border-b border-slate-200">
        {/* Left: Search & Department Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, title, EMP ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Departments</option>
            {data?.departments?.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Breadcrumb if focused on a subtree */}
          {focusedRootId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700">
              <span className="text-indigo-400">Team:</span>
              <span>{focusedEmployeeName}</span>
              <button
                onClick={handleResetToFullTree}
                className="ml-1 p-0.5 hover:bg-indigo-100 rounded text-indigo-600"
                title="Return to full company org chart"
              >
                <ArrowLeft className="size-3" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Metrics & Zoom / Expand Controls */}
        <div className="flex items-center gap-2">
          {data && (
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 mr-2 pr-3 border-r border-slate-200">
              <span className="font-semibold text-slate-700">
                {data.totalEmployees} <span className="font-normal text-slate-500">Members</span>
              </span>
              <span>•</span>
              <span>
                {data.maxDepth} <span className="font-normal text-slate-500">Tiers</span>
              </span>
            </div>
          )}

          {/* Expand / Collapse All */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              onClick={handleExpandAll}
              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded"
              title="Expand all levels"
            >
              Expand All
            </button>
            <span className="text-slate-200">|</span>
            <button
              onClick={handleCollapseAll}
              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded"
              title="Collapse all"
            >
              Collapse
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.1))}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="px-1 text-[11px] font-mono font-medium text-slate-600 min-w-[42px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded ml-0.5"
              title="Reset zoom to 100%"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Visual Tree Canvas (Pan/Scrollable) ── */}
      <div className="flex-1 w-full overflow-auto p-8 flex justify-center items-start min-h-[550px] cursor-grab active:cursor-grabbing bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-72 gap-3">
            <div className="size-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-slate-500">Loading organization tree...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-72 gap-3 text-center max-w-md">
            <div className="size-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold">
              !
            </div>
            <p className="text-sm font-semibold text-slate-800">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadTree(focusedRootId || undefined)}>
              Try Again
            </Button>
          </div>
        ) : !data || data.roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 gap-3 text-center max-w-md">
            <Users className="size-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No organizational hierarchy records found.</p>
            <p className="text-xs text-slate-500">
              Assign reporting managers in employee profiles to populate the visual reporting tree.
            </p>
          </div>
        ) : (
          <div
            className="transition-transform duration-150 origin-top flex flex-col items-center gap-12"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {data.roots.map((rootNode) => (
              <TreeNodeRenderer
                key={rootNode.id}
                node={rootNode}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onFocusTeam={handleFocusTeam}
                searchQuery={searchQuery}
                selectedDept={selectedDept}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer Info Strip ── */}
      <div className="px-4 py-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            Active
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-indigo-500" />
            Focus Team Subtree
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-slate-300" />
            Direct Reporting Line
          </span>
        </div>
        <div>
          <span>Tip: Click </span>
          <strong className="text-slate-700">Focus</strong>
          <span> on any manager to isolate their team hierarchy.</span>
        </div>
      </div>
    </div>
  )
}

