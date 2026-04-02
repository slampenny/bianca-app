import { Alert, CreatedModel, AlertImportance, AlertVisibility } from '../../app/services/api/api.types';

export function newAlert(
    source: any, 
    model: CreatedModel, 
    importance: AlertImportance = 'low', 
    visibility: AlertVisibility = 'allCaregivers'
  ): Partial<Alert> {
    const relevanceUntil = new Date();
    relevanceUntil.setDate(relevanceUntil.getDate() + 7);
    return {
      message: 'Test Alert' as string,
      importance,
      alertType: 'system',
      createdBy: source.id, // replace with a valid ObjectId
      createdModel: model,
      visibility,
      relevanceUntil,
    };
  }