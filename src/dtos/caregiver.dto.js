const PatientDTO = require("./patient.dto");
const OrgDTO = require("./org.dto");

const CaregiverDTO = (caregiver) => {
    const {
      _id, name, avatar, email, phone, role, isEmailVerified, createdAt, updatedAt, org, patients
    } = caregiver;
  
    const id = _id;
    
    // Transform the org using OrgDTO, ensuring it handles both populated and ID-only cases
    const orgDetails = OrgDTO(org);
  
    // Transform patients using PatientDTO if they are populated or just return their IDs
    const patientDetails = patients.map(patient => 
      typeof patient === 'object' ? PatientDTO(patient) : { id: patient }
    );
  
    return {
      id,
      name,
      avatar,
      email,
      phone,
      role,
      isEmailVerified,
      org: orgDetails,
      patients: patientDetails
    };
  }
  
  module.exports = CaregiverDTO;