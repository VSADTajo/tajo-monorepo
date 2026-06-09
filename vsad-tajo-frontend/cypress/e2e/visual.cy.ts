/* eslint-disable cypress/no-unnecessary-waiting */
// https://on.cypress.io/api

describe('Visual Tests', () => {
  it('layer is drawing', () => {
    cy.visit('/Map')
    cy.wait(5000)
      .get('[test-id="map"]')
      .wait(5000)
      .compareSnapshot({
        name: 'map-screenshot',
        cypressScreenshotOptions: { overwrite: true },
        testThreshold: 1,
      })
    cy.wait(5000).get('[test-id="add-layer"]').click()

    cy.wait(5000)
      .get('[test-id="map"]')
      .compareSnapshot({ name: 'map-screenshot', testThreshold: 0.02 })
      .should('throw')
  })
})
