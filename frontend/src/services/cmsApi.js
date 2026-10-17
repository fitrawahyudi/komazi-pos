import { request } from './api';

export const cmsApi = {
  // Public Landing Page Aggregator
  getPublicLanding: () => request('/public/landing'),

  // 1. Config (Hero & Brand)
  getCmsConfig: () => request('/cms/config'),
  updateCmsConfig: (data) =>
    request('/cms/config', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // 2. Menu Spotlight
  getSpotlights: () => request('/cms/spotlights'),
  createSpotlight: (data) =>
    request('/cms/spotlights', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateSpotlight: (id, data) =>
    request(`/cms/spotlights/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteSpotlight: (id) =>
    request(`/cms/spotlights/${id}`, {
      method: 'DELETE'
    }),
  reorderSpotlights: (items) =>
    request('/cms/spotlights/reorder', {
      method: 'POST',
      body: JSON.stringify({ items })
    }),

  // 3. Promos
  getPromos: () => request('/cms/promos'),
  createPromo: (data) =>
    request('/cms/promos', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updatePromo: (id, data) =>
    request(`/cms/promos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deletePromo: (id) =>
    request(`/cms/promos/${id}`, {
      method: 'DELETE'
    }),

  // 4. Facilities (Café Amenities)
  getFacilities: () => request('/cms/facilities'),
  createFacility: (data) =>
    request('/cms/facilities', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateFacility: (id, data) =>
    request(`/cms/facilities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteFacility: (id) =>
    request(`/cms/facilities/${id}`, {
      method: 'DELETE'
    }),

  // 5. Testimonials
  getTestimonials: () => request('/cms/testimonials'),
  createTestimonial: (data) =>
    request('/cms/testimonials', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateTestimonial: (id, data) =>
    request(`/cms/testimonials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteTestimonial: (id) =>
    request(`/cms/testimonials/${id}`, {
      method: 'DELETE'
    }),

  // 6. Outlet Info
  getOutletInfo: () => request('/cms/outlet'),
  updateOutletInfo: (data) =>
    request('/cms/outlet', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
};
