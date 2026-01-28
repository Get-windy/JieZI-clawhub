import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import {
  getSkillBadges,
  isSkillDeprecated,
  isSkillHighlighted,
  isSkillOfficial,
} from '../lib/badges'
import { isAdmin, isModerator } from '../lib/roles'
import { useAuthStatus } from '../lib/useAuthStatus'

type ManagementSkillEntry = {
  skill: Doc<'skills'>
  latestVersion: Doc<'skillVersions'> | null
  owner: Doc<'users'> | null
}

type RecentVersionEntry = {
  version: Doc<'skillVersions'>
  skill: Doc<'skills'> | null
  owner: Doc<'users'> | null
}

type DuplicateCandidateEntry = {
  skill: Doc<'skills'>
  latestVersion: Doc<'skillVersions'> | null
  fingerprint: string | null
  matches: Array<{ skill: Doc<'skills'>; owner: Doc<'users'> | null }>
  owner: Doc<'users'> | null
}

export const Route = createFileRoute('/management')({
  validateSearch: (search) => ({
    skill: typeof search.skill === 'string' && search.skill.trim() ? search.skill : undefined,
  }),
  component: Management,
})

function Management() {
  const { me } = useAuthStatus()
  const search = Route.useSearch()
  const staff = isModerator(me)
  const admin = isAdmin(me)

  const users = useQuery(api.users.list, admin ? { limit: 50 } : 'skip') as
    | Doc<'users'>[]
    | undefined
  const skills = useQuery(
    api.skills.listForManagement,
    staff ? { limit: 50, includeDeleted: true } : 'skip',
  ) as ManagementSkillEntry[] | undefined
  const recentVersions = useQuery(
    api.skills.listRecentVersions,
    staff ? { limit: 20 } : 'skip',
  ) as RecentVersionEntry[] | undefined
  const flaggedSkills = useQuery(
    api.skills.listFlaggedSkills,
    staff ? { limit: 25 } : 'skip',
  ) as ManagementSkillEntry[] | undefined
  const duplicateCandidates = useQuery(
    api.skills.listDuplicateCandidates,
    staff ? { limit: 20 } : 'skip',
  ) as DuplicateCandidateEntry[] | undefined

  const setRole = useMutation(api.users.setRole)
  const setBatch = useMutation(api.skills.setBatch)
  const setSoftDeleted = useMutation(api.skills.setSoftDeleted)
  const hardDelete = useMutation(api.skills.hardDelete)
  const changeOwner = useMutation(api.skills.changeOwner)
  const setDuplicate = useMutation(api.skills.setDuplicate)
  const setRedactionApproved = useMutation(api.skills.setRedactionApproved)
  const setOfficialBadge = useMutation(api.skills.setOfficialBadge)
  const setDeprecatedBadge = useMutation(api.skills.setDeprecatedBadge)

  const [duplicateInputs, setDuplicateInputs] = useState<Record<string, string>>({})
  const [ownerInputs, setOwnerInputs] = useState<Record<string, string>>({})

  const skillById = useMemo(() => {
    return new Map((skills ?? []).map((entry) => [entry.skill._id, entry.skill]))
  }, [skills])

  const skillFilter = search.skill?.trim()
  const skillFilterValue = skillFilter?.toLowerCase()
  const filteredSkills = useMemo(() => {
    if (!skillFilterValue) return skills ?? []
    return (skills ?? []).filter((entry) => {
      const slug = entry.skill.slug.toLowerCase()
      const name = entry.skill.displayName.toLowerCase()
      return slug.includes(skillFilterValue) || name.includes(skillFilterValue)
    })
  }, [skills, skillFilterValue])

  if (!staff) {
    return (
      <main className="section">
        <div className="card">Management only.</div>
      </main>
    )
  }

  if (!skills || !recentVersions || !flaggedSkills || !duplicateCandidates) {
    return (
      <main className="section">
        <div className="card">Loading management console…</div>
      </main>
    )
  }

  return (
    <main className="section">
      <h1 className="section-title">Management console</h1>
      <p className="section-subtitle">Moderation, curation, and ownership tools.</p>

      <div className="card">
        <h2 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
          Moderation queue
        </h2>
        {skillFilter ? (
          <div className="section-subtitle" style={{ marginTop: 8 }}>
            Filtering by "{skillFilter}" ·{' '}
            <Link to="/management" search={{ skill: undefined }}>
              Clear filter
            </Link>
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {filteredSkills.length === 0 ? (
            <div className="stat">No skills found.</div>
          ) : (
            filteredSkills.map((entry) => {
              const { skill, latestVersion, owner } = entry
              const canonicalSlug = skill.canonicalSkillId
                ? skillById.get(skill.canonicalSkillId)?.slug
                : ''
              const duplicateValue = duplicateInputs[skill._id] ?? canonicalSlug ?? ''
              const ownerValue = ownerInputs[skill._id] ?? skill.ownerUserId
              const moderationStatus =
                skill.moderationStatus ?? (skill.softDeletedAt ? 'hidden' : 'active')
              const isHighlighted = isSkillHighlighted(skill)
              const isOfficial = isSkillOfficial(skill)
              const isDeprecated = isSkillDeprecated(skill)
              const badges = getSkillBadges(skill)

              return (
                <div key={skill._id} className="stat" style={{ alignItems: 'stretch' }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Link to="/skills/$slug" params={{ slug: skill.slug }}>
                      {skill.displayName}
                    </Link>
                    <div className="section-subtitle" style={{ margin: 0 }}>
                      @{owner?.handle ?? owner?.name ?? 'user'} · v{latestVersion?.version ?? '—'} ·
                      updated {formatTimestamp(skill.updatedAt)} · {moderationStatus}
                      {badges.length ? ` · ${badges.join(', ').toLowerCase()}` : ''}
                    </div>
                    {skill.moderationFlags?.length ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {skill.moderationFlags.map((flag: string) => (
                          <span key={flag} className="tag">
                            {flag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="mono" style={{ fontSize: 12 }}>
                          duplicate of
                        </span>
                        <input
                          className="search-input"
                          style={{ minWidth: 180 }}
                          value={duplicateValue}
                          onChange={(event) =>
                            setDuplicateInputs((prev) => ({
                              ...prev,
                              [skill._id]: event.target.value,
                            }))
                          }
                          placeholder="canonical slug"
                        />
                      </label>
                      <button
                        className="btn"
                        type="button"
                        onClick={() =>
                          void setDuplicate({
                            skillId: skill._id,
                            canonicalSlug: duplicateValue.trim() || undefined,
                          })
                        }
                      >
                        Set duplicate
                      </button>
                      {admin ? (
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span className="mono" style={{ fontSize: 12 }}>
                            owner
                          </span>
                          <select
                            value={ownerValue}
                            onChange={(event) =>
                              setOwnerInputs((prev) => ({
                                ...prev,
                                [skill._id]: event.target.value,
                              }))
                            }
                          >
                            {(users ?? []).map((user) => (
                              <option key={user._id} value={user._id}>
                                @{user.handle ?? user.name ?? 'user'}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              void changeOwner({
                                skillId: skill._id,
                                ownerUserId: ownerValue as Doc<'users'>['_id'],
                              })
                            }
                          >
                            Change owner
                          </button>
                        </label>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        void setSoftDeleted({ skillId: skill._id, deleted: !skill.softDeletedAt })
                      }
                    >
                      {skill.softDeletedAt ? 'Restore' : 'Hide'}
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        void setBatch({
                          skillId: skill._id,
                          batch: isHighlighted ? undefined : 'highlighted',
                        })
                      }
                    >
                      {isHighlighted ? 'Unhighlight' : 'Highlight'}
                    </button>
                    {admin ? (
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Hard delete ${skill.displayName}?`)) return
                          void hardDelete({ skillId: skill._id })
                        }}
                      >
                        Hard delete
                      </button>
                    ) : null}
                    {admin ? (
                      <>
                        <button
                          className="btn"
                          type="button"
                          onClick={() =>
                            void setRedactionApproved({
                              skillId: skill._id,
                              approved: !skill.badges?.redactionApproved,
                            })
                          }
                        >
                          {skill.badges?.redactionApproved ? 'Clear badge' : 'Approve redaction'}
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={() =>
                            void setOfficialBadge({
                              skillId: skill._id,
                              official: !isOfficial,
                            })
                          }
                        >
                          {isOfficial ? 'Remove official' : 'Mark official'}
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={() =>
                            void setDeprecatedBadge({
                              skillId: skill._id,
                              deprecated: !isDeprecated,
                            })
                          }
                        >
                          {isDeprecated ? 'Remove deprecated' : 'Mark deprecated'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
          Malicious watch
        </h2>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {flaggedSkills.length === 0 ? (
            <div className="stat">No flagged skills.</div>
          ) : (
            flaggedSkills.map((entry) => (
              <div key={entry.skill._id} className="stat" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <strong>{entry.skill.displayName}</strong>
                  <div className="section-subtitle" style={{ margin: 0 }}>
                    @{entry.owner?.handle ?? entry.owner?.name ?? 'user'} ·
                    {entry.skill.moderationFlags?.join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link to="/skills/$slug" params={{ slug: entry.skill.slug }}>
                    View
                  </Link>
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      void setSoftDeleted({
                        skillId: entry.skill._id,
                        deleted: !entry.skill.softDeletedAt,
                      })
                    }
                  >
                    {entry.skill.softDeletedAt ? 'Restore' : 'Hide'}
                  </button>
                  {admin ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Hard delete ${entry.skill.displayName}?`)) return
                        void hardDelete({ skillId: entry.skill._id })
                      }}
                    >
                      Hard delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
          Duplicate candidates
        </h2>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {duplicateCandidates.length === 0 ? (
            <div className="stat">No duplicate candidates.</div>
          ) : (
            duplicateCandidates.map((entry) => (
              <div key={entry.skill._id} className="stat" style={{ alignItems: 'stretch' }}>
                <div>
                  <strong>{entry.skill.displayName}</strong>
                  <div className="section-subtitle" style={{ margin: 0 }}>
                    @{entry.owner?.handle ?? entry.owner?.name ?? 'user'} ·
                    v{entry.latestVersion?.version ?? '—'}
                  </div>
                  <div className="section-subtitle" style={{ margin: 0 }}>
                    Fingerprint {entry.fingerprint?.slice(0, 8)}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {entry.matches.map((match) => (
                    <div key={match.skill._id} className="stat" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <strong>{match.skill.displayName}</strong>
                        <div className="section-subtitle" style={{ margin: 0 }}>
                          @{match.owner?.handle ?? match.owner?.name ?? 'user'} · {match.skill.slug}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link to="/skills/$slug" params={{ slug: match.skill.slug }}>
                          View
                        </Link>
                        <button
                          className="btn"
                          type="button"
                          onClick={() =>
                            void setDuplicate({
                              skillId: entry.skill._id,
                              canonicalSlug: match.skill.slug,
                            })
                          }
                        >
                          Mark duplicate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
          Recent pushes
        </h2>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {recentVersions.length === 0 ? (
            <div className="stat">No recent versions.</div>
          ) : (
            recentVersions.map((entry) => (
              <div key={entry.version._id} className="stat" style={{ justifyContent: 'space-between' }}>
                <div>
                  <strong>{entry.skill?.displayName ?? 'Unknown skill'}</strong>
                  <div className="section-subtitle" style={{ margin: 0 }}>
                    v{entry.version.version} · @{entry.owner?.handle ?? entry.owner?.name ?? 'user'}
                  </div>
                </div>
                {entry.skill ? (
                  <Link to="/skills/$slug" params={{ slug: entry.skill.slug }}>
                    View
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {admin ? (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
            Users
          </h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {(users ?? []).map((user) => (
              <div key={user._id} className="stat" style={{ justifyContent: 'space-between' }}>
                <span className="mono">@{user.handle ?? user.name ?? 'user'}</span>
                <select
                  value={user.role ?? 'user'}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === 'admin' || value === 'moderator' || value === 'user') {
                      void setRole({ userId: user._id, role: value })
                    }
                  }}
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  )
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString()
}
