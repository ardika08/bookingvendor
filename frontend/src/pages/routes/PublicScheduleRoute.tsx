import { useParams } from 'react-router-dom'
import { PublicSchedulePage } from '@/pages/PublicSchedulePage'

export function PublicScheduleRoute() {
  const { slug = '' } = useParams()
  return <PublicSchedulePage slug={slug} />
}
