const { ObjectId } = require('mongodb');
const PatientDTO = require("./patient.dto");
const OrgDTO = require("./org.dto");

const CaregiverDTO = (caregiver) => {
    const {
      _id, name, avatar, email, phone, isEmailVerified, org, patients
    } = caregiver;
  
    const id = _id;
    
    // Check if org is an ObjectId, if so, convert it to string
    const orgId = org instanceof ObjectId ? org.toString() : OrgDTO(org);

    // Check if patients are ObjectIds, if so, convert them to strings
    const patientIds = patients.map(patient => 
      patient instanceof ObjectId ? patient.toString() : PatientDTO(patient)
    );
  
    return {
      id,
      name,
      avatar,
      email,
      phone,
      isEmailVerified,
      org: orgId,
      patients: patientIds
    };
  }
  
  module.exports = CaregiverDTO;