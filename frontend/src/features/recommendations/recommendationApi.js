import { apiClient } from '../../shared/api/client'

export async function getRecommendationOptions() {
  const { data } = await apiClient.get('/recommendation-options')
  return data
}

export async function previewCourse(scheduleId, conditions) {
  const { data } = await apiClient.post(`/schedules/${scheduleId}/course-recommendations/preview`, conditions)
  return data
}

export async function addRecommendedCourse(scheduleId, places) {
  const { data } = await apiClient.post(`/schedules/${scheduleId}/places/batch`, {
    places,
  })
  return data.items
}
