import { Router } from 'express';
import { BeneficiaryController } from './beneficiary.controller';
import { authMiddleware, authorize } from '../../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../../shared/middleware/org-scope';

const router = Router({ mergeParams: true });

router.use(authMiddleware, orgScopeMiddleware);

// Consolidated snapshot
router.get('/', BeneficiaryController.getSnapshot);

// Emergency Contacts
router.get('/emergency-contacts', BeneficiaryController.listEmergencyContacts);
router.post('/emergency-contacts', BeneficiaryController.addEmergencyContact);
router.put('/emergency-contacts/:contactId', BeneficiaryController.updateEmergencyContact);
router.delete('/emergency-contacts/:contactId', BeneficiaryController.deleteEmergencyContact);

// Dependents (Family & Insurance)
router.get('/dependents', BeneficiaryController.listDependents);
router.post('/dependents', BeneficiaryController.addDependent);
router.put('/dependents/:dependentId', BeneficiaryController.updateDependent);
router.delete('/dependents/:dependentId', BeneficiaryController.deleteDependent);

// Statutory Nominees (PF, Gratuity, Life Insurance)
router.get('/nominees', BeneficiaryController.listNominees);
router.post('/nominees', BeneficiaryController.addNominee);
router.put('/nominees/:nomineeId', BeneficiaryController.updateNominee);
router.delete('/nominees/:nomineeId', BeneficiaryController.deleteNominee);

export default router;
