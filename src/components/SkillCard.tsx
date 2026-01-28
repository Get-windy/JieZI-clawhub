import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { Doc } from '../../convex/_generated/dataModel'

type SkillCardProps = {
  skill: Doc<'skills'>
  badge?: string | string[]
  chip?: string
  summaryFallback: string
  meta: ReactNode
  href?: string
}

export function SkillCard({ skill, badge, chip, summaryFallback, meta, href }: SkillCardProps) {
  const link = href ?? `/skills/${skill.slug}`
  const badges = Array.isArray(badge) ? badge : badge ? [badge] : []

  return (
    <Link to={link} className="card skill-card">
      {badges.length || chip ? (
        <div className="skill-card-tags">
          {badges.map((label) => (
            <div key={label} className="tag">
              {label}
            </div>
          ))}
          {chip ? <div className="tag tag-accent tag-compact">{chip}</div> : null}
        </div>
      ) : null}
      <h3 className="skill-card-title">{skill.displayName}</h3>
      <p className="skill-card-summary">{skill.summary ?? summaryFallback}</p>
      <div className="skill-card-footer">{meta}</div>
    </Link>
  )
}
