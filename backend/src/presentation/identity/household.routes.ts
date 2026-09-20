import router from '@adonisjs/core/services/router'

const HouseholdController = () => import('./household.controller.js')

router.get('/api/households/mine', [HouseholdController, 'mine'])
router.post('/api/households', [HouseholdController, 'create'])
router.patch('/api/households/mine', [HouseholdController, 'rename'])
router.post('/api/households/join', [HouseholdController, 'join'])
router.post('/api/households/invite-code/regenerate', [HouseholdController, 'regenerateInviteCode'])
router.delete('/api/households/members/:userId', [HouseholdController, 'removeMember'])
router.post('/api/households/leave', [HouseholdController, 'leave'])
router.post('/api/households/transfer-ownership', [HouseholdController, 'transferOwnership'])
router.delete('/api/households/mine', [HouseholdController, 'destroy'])
