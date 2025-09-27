// seedDatabase.js
const mongoose = require('mongoose');
const faker = require('faker');
const { Alert, Org, Caregiver, Patient, Conversation, Message, Schedule, PaymentMethod, Invoice } = require('../models');
const config = require('../config/config');

// Import test fixtures directly for production
const orgFixture = require('../../tests/fixtures/org.fixture');
const caregiverFixture = require('../../tests/fixtures/caregiver.fixture');
const patientFixture = require('../../tests/fixtures/patient.fixture');
const alertFixture = require('../../tests/fixtures/alert.fixture');
const scheduleFixture = require('../../tests/fixtures/schedule.fixture');
const conversationFixture = require('../../tests/fixtures/conversation.fixture');
const paymentMethodFixture = require('../../tests/fixtures/paymentMethod.fixture');

// Extract the needed exports
const { orgOne, insertOrgs } = orgFixture;
const { caregiverOne, admin, hashedPassword, insertCaregiversAndAddToOrg } = caregiverFixture;
const { patientOne, patientTwo, insertPatientsAndAddToCaregiver } = patientFixture;
const { alertOne, alertTwo, alertThree, expiredAlert, insertAlerts } = alertFixture;
const { scheduleOne, scheduleTwo, insertScheduleAndAddToPatient } = scheduleFixture;
const { conversationOne, conversationTwo, insertConversations } = conversationFixture;
const { paymentMethodOne, paymentMethodTwo, insertPaymentMethods } = paymentMethodFixture;

/**
 * Add declining patient conversations to show progression over time
 * @param {string} patientId - The patient ID to add conversations for
 */
async function addDecliningPatientConversations(patientId) {
  console.log('Adding declining patient conversations for patient:', patientId);
  
  const decliningConversations = [];
  
  // Month 1: Healthy baseline
  const month1Date = new Date();
  month1Date.setMonth(month1Date.getMonth() - 5);
  
  // Create conversation first
  const conv1 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient discussing medication management and overall health status.',
    analyzedData: {},
    metadata: { source: 'declining_patient_seed', month: 1 },
    createdAt: month1Date,
    updatedAt: month1Date,
    startTime: month1Date,
    endTime: new Date(month1Date.getTime() + 30 * 60 * 1000), // 30 minutes later
    duration: 30,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.30, // $0.30 for 30 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv1.save();
  
  // Create and save message
  const msg1 = new Message({
    role: 'patient',
    content: 'Good morning! I hope you are having a wonderful day. I wanted to discuss my medication schedule with you today. I take my blood pressure medication every morning at 8 AM, and I have been very consistent with it. I feel good and I have energy. I am managing my health well and everything is going smoothly. My memory has been sharp and I have been able to keep track of all my appointments and medications without any issues.',
    conversationId: conv1._id
  });
  await msg1.save();
  
  // Update conversation with message reference
  conv1.messages.push(msg1._id);
  await conv1.save();
  decliningConversations.push(conv1);
  
  // Month 2: Slight concerns
  const month2Date = new Date();
  month2Date.setMonth(month2Date.getMonth() - 4);
  
  const conv2 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient expressing mild concerns about mood and memory.',
    analyzedData: {},
    metadata: { source: 'declining_patient_seed', month: 2 },
    createdAt: month2Date,
    updatedAt: month2Date,
    startTime: month2Date,
    endTime: new Date(month2Date.getTime() + 25 * 60 * 1000), // 25 minutes later
    duration: 25,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.25, // $0.25 for 25 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv2.save();
  
  const msg2 = new Message({
    role: 'patient',
    content: 'Hi there, I wanted to talk about how I have been feeling lately. I have been having some ups and downs. Some days I feel okay, but other days I feel really down. I have been having trouble sleeping and I worry a lot about work. I am managing okay though. I have noticed that sometimes I forget where I put my keys, but I think that is normal for my age.',
    conversationId: conv2._id
  });
  await msg2.save();
  
  conv2.messages.push(msg2._id);
  await conv2.save();
  decliningConversations.push(conv2);
  
  // Month 3: More noticeable issues
  const month3Date = new Date();
  month3Date.setMonth(month3Date.getMonth() - 3);
  
  const conv3 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient showing increased cognitive concerns and anxiety.',
    analyzedData: {},
    metadata: { source: 'declining_patient_seed', month: 3 },
    createdAt: month3Date,
    updatedAt: month3Date,
    startTime: month3Date,
    endTime: new Date(month3Date.getTime() + 35 * 60 * 1000), // 35 minutes later
    duration: 35,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.35, // $0.35 for 35 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv3.save();
  
  const msg3 = new Message({
    role: 'patient',
    content: 'I am feeling more confused lately. I keep forgetting things and I do not know why. I had trouble remembering my daughter\'s name yesterday and that scared me. I feel like I am losing my mind. I cannot concentrate on anything and I feel very anxious about everything. I worry that something is really wrong with me.',
    conversationId: conv3._id
  });
  await msg3.save();
  
  conv3.messages.push(msg3._id);
  await conv3.save();
  decliningConversations.push(conv3);
  
  // Month 4: Clear decline
  const month4Date = new Date();
  month4Date.setMonth(month4Date.getMonth() - 2);
  
  const conv4 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient showing significant cognitive decline and confusion.',
    analyzedData: {},
    metadata: { source: 'declining_patient_seed', month: 4 },
    createdAt: month4Date,
    updatedAt: month4Date,
    startTime: month4Date,
    endTime: new Date(month4Date.getTime() + 40 * 60 * 1000), // 40 minutes later
    duration: 40,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.40, // $0.40 for 40 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv4.save();
  
  const msg4 = new Message({
    role: 'patient',
    content: 'I do not understand what is happening to me. I cannot remember what I did yesterday or what I am supposed to do today. I feel lost and confused all the time. I am afraid to leave my house because I might get lost. I cannot think clearly anymore and I keep saying the wrong words. I feel like I am going crazy.',
    conversationId: conv4._id
  });
  await msg4.save();
  
  conv4.messages.push(msg4._id);
  await conv4.save();
  decliningConversations.push(conv4);
  
  // Month 5: Severe decline
  const month5Date = new Date();
  month5Date.setMonth(month5Date.getMonth() - 1);
  
  const conv5 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient showing severe cognitive decline with disorientation.',
    analyzedData: {},
    metadata: { source: 'declining_patient_seed', month: 5 },
    createdAt: month5Date,
    updatedAt: month5Date,
    startTime: month5Date,
    endTime: new Date(month5Date.getTime() + 45 * 60 * 1000), // 45 minutes later
    duration: 45,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.45, // $0.45 for 45 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv5.save();
  
  const msg5 = new Message({
    role: 'patient',
    content: 'Help me... please help me. I do not know where I am or what is happening. I am... I am at home, I think. But I do not remember how I got here. I feel confused and afraid. I cannot think clearly and I keep forgetting things. The thing is... you know what I mean? I keep repeating myself and I do not know why. I am scared.',
    conversationId: conv5._id
  });
  await msg5.save();
  
  conv5.messages.push(msg5._id);
  await conv5.save();
  decliningConversations.push(conv5);
  
  // Month 6: Crisis point
  const month6Date = new Date();
  
  const conv6 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient in crisis with severe depression and cognitive impairment.',
    analyzedData: {},
    metadata: { source: 'declining_patient_seed', month: 6 },
    createdAt: month6Date,
    updatedAt: month6Date,
    startTime: month6Date,
    endTime: new Date(month6Date.getTime() + 50 * 60 * 1000), // 50 minutes later
    duration: 50,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.50, // $0.50 for 50 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv6.save();
  
  const msg6 = new Message({
    role: 'patient',
    content: 'I do not know why I keep trying. Nothing ever gets better. I cannot function anymore. I cannot work, I cannot take care of myself, I cannot even get out of bed most days. I just want the pain to stop. I feel worthless and hopeless about everything. I do not know who I am anymore or what I am supposed to do. I am lost.',
    conversationId: conv6._id
  });
  await msg6.save();
  
  conv6.messages.push(msg6._id);
  await conv6.save();
  decliningConversations.push(conv6);
  
  console.log(`Created ${decliningConversations.length} declining patient conversations`);
  
  return decliningConversations;
}

/**
 * Add normal patient conversations to show stable/healthy patterns
 * @param {string} patientId - The patient ID to add conversations for
 */
async function addNormalPatientConversations(patientId) {
  console.log('Adding normal patient conversations for patient:', patientId);
  
  const normalConversations = [];
  
  // Month 1: Healthy baseline
  const month1Date = new Date();
  month1Date.setMonth(month1Date.getMonth() - 5);
  
  const conv1 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient showing healthy cognitive function and good communication.',
    analyzedData: {},
    metadata: { source: 'normal_patient_seed', month: 1 },
    createdAt: month1Date,
    updatedAt: month1Date,
    startTime: month1Date,
    endTime: new Date(month1Date.getTime() + 20 * 60 * 1000), // 20 minutes later
    duration: 20,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.20, // $0.20 for 20 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv1.save();
  
  const msg1 = new Message({
    role: 'patient',
    content: 'Good morning! I hope you are having a wonderful day. I wanted to discuss my medication schedule with you today. I take my blood pressure medication every morning at 8 AM, and I have been very consistent with it. I feel good and I have energy. I am managing my health well and everything is going smoothly. My memory has been sharp and I have been able to keep track of all my appointments and medications without any issues.',
    conversationId: conv1._id
  });
  await msg1.save();
  
  conv1.messages.push(msg1._id);
  await conv1.save();
  normalConversations.push(conv1);
  
  // Month 2: Continued good health
  const month2Date = new Date();
  month2Date.setMonth(month2Date.getMonth() - 4);
  
  const conv2 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient maintaining good cognitive function and clear communication.',
    analyzedData: {},
    metadata: { source: 'normal_patient_seed', month: 2 },
    createdAt: month2Date,
    updatedAt: month2Date,
    startTime: month2Date,
    endTime: new Date(month2Date.getTime() + 25 * 60 * 1000), // 25 minutes later
    duration: 25,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.25, // $0.25 for 25 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv2.save();
  
  const msg2 = new Message({
    role: 'patient',
    content: 'Hello again! I am doing well today. I have been keeping up with my exercise routine and eating healthy meals. My doctor says my blood pressure is stable and my cholesterol levels are improving. I feel mentally alert and I have been reading books and doing crossword puzzles to keep my mind active. I am also staying socially connected with friends and family.',
    conversationId: conv2._id
  });
  await msg2.save();
  
  conv2.messages.push(msg2._id);
  await conv2.save();
  normalConversations.push(conv2);
  
  // Month 3: Stable and healthy
  const month3Date = new Date();
  month3Date.setMonth(month3Date.getMonth() - 3);
  
  const conv3 = new Conversation({
    patientId: patientId,
    messages: [],
    history: 'Patient showing consistent cognitive health and clear thinking.',
    analyzedData: {},
    metadata: { source: 'normal_patient_seed', month: 3 },
    createdAt: month3Date,
    updatedAt: month3Date,
    startTime: month3Date,
    endTime: new Date(month3Date.getTime() + 30 * 60 * 1000), // 30 minutes later
    duration: 30,
    status: 'completed',
    callType: 'wellness-check',
    cost: 0.30, // $0.30 for 30 minutes at $0.10/minute
    lineItemId: null // Unbilled
  });
  await conv3.save();
  
  const msg3 = new Message({
    role: 'patient',
    content: 'I wanted to share some good news with you today. I have been feeling great and my recent health checkup went very well. My doctor was pleased with all my test results. I have been maintaining a positive outlook and staying active in my community. I volunteer at the local library twice a week and I find it very rewarding. My memory remains sharp and I have no trouble remembering important dates and appointments.',
    conversationId: conv3._id
  });
  await msg3.save();
  
  conv3.messages.push(msg3._id);
  await conv3.save();
  normalConversations.push(conv3);
  
  console.log(`Created ${normalConversations.length} normal patient conversations`);
  
  return normalConversations;
}

async function seedDatabase() {
  try {
    // Connect to the database
    await mongoose.connect(config.mongoose.url, { useNewUrlParser: true, useUnifiedTopology: true });

    // Clear the database
    await Org.deleteMany({});
    await Caregiver.deleteMany({});
    await Patient.deleteMany({});
    await Alert.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Schedule.deleteMany({});
    await PaymentMethod.deleteMany({});
    await Invoice.deleteMany({});
    console.log('Cleared the database');

    // Insert a single organization
    const [org1] = await insertOrgs([orgOne]);
    console.log('Inserted org:', org1);

    // Set both caregivers to belong to the same org.
    caregiverOne.org = org1._id;
    admin.org = org1._id;

    // Insert caregivers and add them to org1.
    // This will insert both admin and caregiverOne to org1.
    const caregivers = await insertCaregiversAndAddToOrg(org1, [admin, caregiverOne]);
    console.log('Inserted caregivers:', caregivers);

    // Create and insert a super admin user
    const superAdmin = {
      name: 'Super Admin',
      email: 'superadmin@example.org',
      phone: '+16045624263',
      password: hashedPassword,
      role: 'superAdmin',
      org: org1._id,
      patients: [],
      isEmailVerified: true,
    };
    
    const superAdminRecord = await insertCaregiversAndAddToOrg(org1, [superAdmin]);
    console.log('Inserted super admin:', superAdminRecord);

    // Find the caregiverOne (fake@example.org) to associate patients with
    const caregiverOneRecord = caregivers.find(c => c.email === 'fake@example.org');
    const adminRecord = caregivers.find(c => c.email === 'admin@example.org');
    
    if (!caregiverOneRecord) {
      throw new Error('caregiverOne not found in inserted caregivers');
    }

    // Insert alerts
    await insertAlerts(caregiverOneRecord, 'Caregiver', [alertOne, alertTwo, alertThree, expiredAlert]);
    
    // Create additional alerts for testing
    const alertFour = {
      message: "Patient John Smith missed their scheduled medication dose",
      importance: 'high',
      alertType: 'patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 12), // 12 hours from now
      readBy: [],
    };
    
    const alertFive = {
      message: "New patient registration completed for Sarah Johnson",
      importance: 'low',
      alertType: 'patient',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 72), // 72 hours from now
      readBy: [],
    };
    
    const alertSix = {
      message: "System maintenance scheduled for tonight at 2 AM",
      importance: 'medium',
      alertType: 'system',
      visibility: 'orgAdmin',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 6), // 6 hours from now
      readBy: [],
    };
    
    const alertSeven = {
      message: "Patient Mary Wilson reported feeling dizzy after medication",
      importance: 'urgent',
      alertType: 'patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2 hours from now
      readBy: [],
    };
    
    const alertEight = {
      message: "Monthly billing report is ready for review",
      importance: 'low',
      alertType: 'system',
      visibility: 'orgAdmin',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 168), // 1 week from now
      readBy: [],
    };
    
    const alertNine = {
      message: "Patient Robert Davis completed their wellness check",
      importance: 'low',
      alertType: 'patient',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
      readBy: [],
    };
    
    const alertTen = {
      message: "New caregiver training materials available",
      importance: 'medium',
      alertType: 'system',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 120), // 5 days from now
      readBy: [],
    };
    
    const alertEleven = {
      message: "Patient Lisa Brown needs follow-up appointment scheduling",
      importance: 'high',
      alertType: 'patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48 hours from now
      readBy: [],
    };
    
    const alertTwelve = {
      message: "Database backup completed successfully",
      importance: 'low',
      alertType: 'system',
      visibility: 'orgAdmin',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
      readBy: [],
    };
    
    const alertThirteen = {
      message: "Patient Michael Chen reported improved symptoms",
      importance: 'low',
      alertType: 'patient',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 36), // 36 hours from now
      readBy: [],
    };
    
    const alertFourteen = {
      message: "Emergency contact protocol updated",
      importance: 'high',
      alertType: 'system',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 168), // 1 week from now
      readBy: [],
    };
    
    const alertFifteen = {
      message: "Patient Jennifer Lee missed their wellness check call",
      importance: 'medium',
      alertType: 'patient',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 4), // 4 hours from now
      readBy: [],
    };
    
    // Insert alerts first (without patient references)
    await insertAlerts(caregiverOneRecord, 'Caregiver', [
      alertOne, alertTwo, alertThree, expiredAlert, alertSix, alertEight, alertTen, alertTwelve, alertFourteen
    ]);

    // Create a caregiver with no patients for testing "No patients found" scenario
    const caregiverWithNoPatients = {
      name: 'Test User No Patients',
      email: 'no-patients@example.org',
      phone: '+16045624263',
      password: hashedPassword,
      role: 'staff',
      org: org1._id,
      patients: [],
      isEmailVerified: true,
    };
    
    const caregiverNoPatientsRecord = await insertCaregiversAndAddToOrg(org1, [caregiverWithNoPatients]);
    console.log('Inserted caregiver with no patients:', caregiverNoPatientsRecord);

    // Create patients with specific names that match the frontend tests
    const agnesAlphabet = {
      name: 'Agnes Alphabet',
      email: 'agnes@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const barnabyButton = {
      name: 'Barnaby Button',
      email: 'barnaby@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    // Insert the specific test patients - Agnes for admin, Barnaby for caregiverOne
    const [patient1] = await insertPatientsAndAddToCaregiver(adminRecord, [agnesAlphabet]);
    const [patient2] = await insertPatientsAndAddToCaregiver(caregiverOneRecord, [barnabyButton]);
    console.log('Inserted test patients:', patient1.name, 'for admin and', patient2.name, 'for caregiverOne');
    
    // Create additional patients for testing with predictable names
    const patientThree = {
      name: 'John Smith',
      email: 'john.smith@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientFour = {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientFive = {
      name: 'Mary Wilson',
      email: 'mary.wilson@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientSix = {
      name: 'Robert Davis',
      email: 'robert.davis@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientSeven = {
      name: 'Lisa Brown',
      email: 'lisa.brown@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientEight = {
      name: 'Michael Chen',
      email: 'michael.chen@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientNine = {
      name: 'Jennifer Lee',
      email: 'jennifer.lee@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientTen = {
      name: 'David Miller',
      email: 'david.miller@example.org',
      phone: '+16045624263',
      schedules: [],
    };
    
    const [patient3, patient4, patient5, patient6, patient7, patient8, patient9, patient10] = 
      await insertPatientsAndAddToCaregiver(caregiverOneRecord, [
        patientThree, patientFour, patientFive, patientSix, 
        patientSeven, patientEight, patientNine, patientTen
      ]);
    
    console.log('Inserted patients:', patient1, patient2, patient3, patient4, patient5, patient6, patient7, patient8, patient9, patient10);

    // Insert patient-specific alerts
    const patientAlertFour = {
      ...alertFour,
      relatedPatient: patient1._id,
    };
    
    const patientAlertFive = {
      ...alertFive,
      relatedPatient: patient2._id,
    };
    
    const patientAlertSeven = {
      ...alertSeven,
      relatedPatient: patient3._id,
    };
    
    const patientAlertNine = {
      ...alertNine,
      relatedPatient: patient4._id,
    };
    
    const patientAlertEleven = {
      ...alertEleven,
      relatedPatient: patient5._id,
    };
    
    const patientAlertThirteen = {
      ...alertThirteen,
      relatedPatient: patient6._id,
    };
    
    const patientAlertFifteen = {
      ...alertFifteen,
      relatedPatient: patient7._id,
    };

    await insertAlerts(caregiverOneRecord, 'Caregiver', [
      patientAlertFour, patientAlertFive, patientAlertSeven, patientAlertNine,
      patientAlertEleven, patientAlertThirteen, patientAlertFifteen
    ]);

    // Insert conversations for patients.
    conversationOne.patientId = patient1._id;
    conversationOne.cost = 0.30; // $0.30 for 30 minutes at $0.10/minute
    conversationOne.lineItemId = null; // Unbilled
    
    conversationTwo.patientId = patient2._id;
    conversationTwo.cost = 0.45; // $0.45 for 45 minutes at $0.10/minute
    conversationTwo.lineItemId = null; // Unbilled
    
    // Create additional conversations for patient1 to test autoload
    const conversationThree = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes later
      duration: faker.datatype.number({ min: 15, max: 45 }),
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.30, // $0.30 for 30 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationFour = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), // 45 minutes later
      duration: faker.datatype.number({ min: 20, max: 60 }),
      status: 'completed',
      callType: 'follow-up',
      cost: 0.45, // $0.45 for 45 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationFive = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000), // 25 minutes later
      duration: faker.datatype.number({ min: 10, max: 35 }),
      status: 'completed',
      callType: 'inbound',
      cost: 0.25, // $0.25 for 25 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationSix = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000), // 35 minutes later
      duration: faker.datatype.number({ min: 15, max: 40 }),
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.35, // $0.35 for 35 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationSeven = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
      endTime: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000), // 50 minutes later
      duration: faker.datatype.number({ min: 25, max: 55 }),
      status: 'completed',
      callType: 'follow-up',
      cost: 0.50, // $0.50 for 50 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationEight = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      endTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000), // 20 minutes later
      duration: faker.datatype.number({ min: 10, max: 25 }),
      status: 'completed',
      callType: 'inbound',
      cost: 0.20, // $0.20 for 20 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationNine = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
      endTime: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000 + 40 * 60 * 1000), // 40 minutes later
      duration: faker.datatype.number({ min: 20, max: 45 }),
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.40, // $0.40 for 40 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationTen = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
      endTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes later
      duration: faker.datatype.number({ min: 15, max: 35 }),
      status: 'completed',
      callType: 'follow-up',
      cost: 0.30, // $0.30 for 30 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationEleven = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      endTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 55 * 60 * 1000), // 55 minutes later
      duration: faker.datatype.number({ min: 30, max: 60 }),
      status: 'completed',
      callType: 'inbound',
      cost: 0.55, // $0.55 for 55 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationTwelve = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), // 22 days ago
      endTime: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000), // 25 minutes later
      duration: faker.datatype.number({ min: 10, max: 30 }),
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.25, // $0.25 for 25 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationThirteen = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      endTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), // 45 minutes later
      duration: faker.datatype.number({ min: 20, max: 50 }),
      status: 'completed',
      callType: 'follow-up',
      cost: 0.45, // $0.45 for 45 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationFourteen = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), // 28 days ago
      endTime: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000), // 35 minutes later
      duration: faker.datatype.number({ min: 15, max: 40 }),
      status: 'completed',
      callType: 'inbound',
      cost: 0.35, // $0.35 for 35 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const conversationFifteen = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000), // 50 minutes later
      duration: faker.datatype.number({ min: 25, max: 55 }),
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.50, // $0.50 for 50 minutes at $0.10/minute
      lineItemId: null, // Unbilled
    };
    
    const [conv1, conv2, conv3, conv4, conv5, conv6, conv7, conv8, conv9, conv10, conv11, conv12, conv13, conv14, conv15] = 
      await insertConversations([
        conversationOne, conversationTwo, conversationThree, conversationFour, conversationFive,
        conversationSix, conversationSeven, conversationEight, conversationNine, conversationTen,
        conversationEleven, conversationTwelve, conversationThirteen, conversationFourteen, conversationFifteen
      ]);
    console.log('Inserted conversations');

    // Create some billed conversations to show billing history
    console.log('Creating billed conversations with invoices...');
    
    // Create a sample invoice for the organization
    const sampleInvoice = await Invoice.create({
      org: org1._id,
      invoiceNumber: 'INV-SEED-001', // Use SEED prefix to avoid conflicts with test data
      issueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 30 * 24 * 60 * 60 * 1000), // 30 days from issue
      status: 'paid',
      totalAmount: 2.50, // Total for billed conversations
      notes: 'Sample billed conversations for testing',
    });
    
    // Create line items for the invoice
    const lineItem1 = await require('../models').LineItem.create({
      patientId: patient1._id,
      invoiceId: sampleInvoice._id,
      amount: 1.20, // $1.20 for 2 conversations
      description: 'Billed conversations - 2 conversation(s)',
      periodStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      quantity: 2,
      unitPrice: 0.60
    });
    
    const lineItem2 = await require('../models').LineItem.create({
      patientId: patient2._id,
      invoiceId: sampleInvoice._id,
      amount: 1.30, // $1.30 for 2 conversations
      description: 'Billed conversations - 2 conversation(s)',
      periodStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      quantity: 2,
      unitPrice: 0.65
    });
    
    // Create billed conversations for patient1
    const billedConv1 = await Conversation.create({
      patientId: patient1._id,
      messages: [],
      history: 'Billed conversation 1 - wellness check',
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
      endTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes later
      duration: 30,
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.60, // $0.60 for 30 minutes at $0.10/minute
      lineItemId: lineItem1._id, // Billed
    });
    
    const billedConv2 = await Conversation.create({
      patientId: patient1._id,
      messages: [],
      history: 'Billed conversation 2 - follow-up',
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
      endTime: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 60 minutes later
      duration: 60,
      status: 'completed',
      callType: 'follow-up',
      cost: 0.60, // $0.60 for 60 minutes at $0.10/minute
      lineItemId: lineItem1._id, // Billed
    });
    
    // Create billed conversations for patient2
    const billedConv3 = await Conversation.create({
      patientId: patient2._id,
      messages: [],
      history: 'Billed conversation 3 - inbound call',
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000), // 17 days ago
      endTime: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), // 45 minutes later
      duration: 45,
      status: 'completed',
      callType: 'inbound',
      cost: 0.65, // $0.65 for 45 minutes at $0.10/minute
      lineItemId: lineItem2._id, // Billed
    });
    
    const billedConv4 = await Conversation.create({
      patientId: patient2._id,
      messages: [],
      history: 'Billed conversation 4 - wellness check',
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      endTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 65 * 60 * 1000), // 65 minutes later
      duration: 65,
      status: 'completed',
      callType: 'wellness-check',
      cost: 0.65, // $0.65 for 65 minutes at $0.10/minute
      lineItemId: lineItem2._id, // Billed
    });
    
    console.log('Created billed conversations and invoice:', sampleInvoice.invoiceNumber);

    // Add declining patient conversations for Agnes Alphabet (patient1)
    await addDecliningPatientConversations(patient1._id);

    // Add some normal conversation data for Barnaby Button (patient2)
    await addNormalPatientConversations(patient2._id);

    // Insert conversation-specific alerts
    const conversationAlertThree = {
      ...alertThree,
      relatedPatient: patient1._id,
      relatedConversation: conv3._id,
    };

    const conversationAlertSchedule = {
      message: "Wellness check conversation completed - follow-up scheduled",
      importance: 'medium',
      alertType: 'conversation',
      relatedPatient: patient1._id,
      relatedConversation: conv6._id,
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
      readBy: [],
    };

    const conversationAlertUrgent = {
      message: "Patient reported concerning symptoms during conversation",
      importance: 'urgent',
      alertType: 'conversation',
      relatedPatient: patient1._id,
      relatedConversation: conv7._id,
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2 hours from now
      readBy: [],
    };

    await insertAlerts(caregiverOneRecord, 'Caregiver', [
      conversationAlertThree, conversationAlertSchedule, conversationAlertUrgent
    ]);

    // Seed schedules for patients.
    await insertScheduleAndAddToPatient(patient1, scheduleOne);
    await insertScheduleAndAddToPatient(patient2, scheduleTwo);
    console.log('Inserted schedules');

    // ----------------------
    // SEED PAYMENT DATA
    // ----------------------
    console.log('Seeding PaymentMethod and Invoice data...');

    // Insert dummy PaymentMethods for org1 using your fixture.
    const paymentMethods = await insertPaymentMethods(org1, [paymentMethodOne, paymentMethodTwo]);
    console.log('Seeded PaymentMethods:', paymentMethods);

    // Create a dummy invoice for org1.
    const dummyInvoiceData = {
      org: org1._id,
      invoiceNumber: 'INV-SEED-002', // Use SEED prefix to avoid conflicts with test data
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'pending',
      totalAmount: 100,
      paymentMethod: paymentMethods[0]._id,
      stripePaymentIntentId: 'pi_test',
      stripeInvoiceId: 'in_test',
      notes: 'Dummy invoice seeded for frontend display',
    };

    const invoiceRecord = await Invoice.create(dummyInvoiceData);
    console.log('Seeded Invoice:', invoiceRecord);

    // Add sentiment analysis to seeded conversations
    console.log('Adding sentiment analysis to seeded conversations...');
    try {
      const { getOpenAISentimentServiceInstance } = require('../services/openai.sentiment.service');
      const sentimentService = getOpenAISentimentServiceInstance();
      
      // Get all conversations for sentiment analysis
      const allConversations = await Conversation.find({
        status: 'completed',
        messages: { $exists: true, $ne: [] }
      }).populate('messages');
      
      console.log(`Found ${allConversations.length} conversations to analyze for sentiment`);
      
      // Analyze sentiment for each conversation
      for (const conversation of allConversations) {
        try {
          // Check if already has sentiment analysis
          if (conversation.analyzedData?.sentiment) {
            console.log(`Conversation ${conversation._id} already has sentiment analysis, skipping`);
            continue;
          }
          
          // Format conversation text from messages
          const conversationText = conversation.messages
            .map(msg => {
              const speaker = msg.role === 'assistant' ? 'Bianca' : 'Patient';
              return `${speaker}: ${msg.content}`;
            })
            .join('\n');
          
          if (!conversationText.trim()) {
            console.log(`Conversation ${conversation._id} has no text content, skipping`);
            continue;
          }
          
          // Perform sentiment analysis
          const analysisResult = await sentimentService.analyzeSentiment(conversationText, {
            detailed: true
          });
          
          if (analysisResult.success) {
            // Update conversation with sentiment analysis
            await Conversation.findByIdAndUpdate(conversation._id, {
              $set: {
                'analyzedData.sentiment': analysisResult.data,
                'analyzedData.sentimentAnalyzedAt': new Date()
              }
            });
            
            console.log(`Added sentiment analysis to conversation ${conversation._id}: ${analysisResult.data.overallSentiment} (${analysisResult.data.sentimentScore})`);
          } else {
            console.warn(`Failed to analyze sentiment for conversation ${conversation._id}: ${analysisResult.error}`);
          }
          
          // Add small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.warn(`Error analyzing sentiment for conversation ${conversation._id}:`, error.message);
        }
      }
      
      console.log('Sentiment analysis completed for seeded conversations');
    } catch (error) {
      console.warn('Failed to add sentiment analysis to seeded data:', error.message);
      // Don't fail the entire seeding process if sentiment analysis fails
    }

    // Run medical analysis on the seeded patient data
    console.log('Running medical analysis on seeded patient data...');
    try {
      const medicalAnalysisScheduler = require('../services/ai/medicalAnalysisScheduler.service');
      
      // Wait a moment for the scheduler to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Run multiple analyses on Agnes Alphabet (patient1) to create trend data
      console.log('Triggering multiple medical analyses for Agnes Alphabet...');
      for (let i = 0; i < 3; i++) {
        await medicalAnalysisScheduler.schedulePatientAnalysis(patient1._id.toString(), {
          trigger: 'seeding',
          batchId: `seeding-${Date.now()}-${i}`
        });
        // Wait a moment between analyses
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Also run analysis on Barnaby Button (patient2) for variety
      console.log('Triggering medical analysis for Barnaby Button...');
      await medicalAnalysisScheduler.schedulePatientAnalysis(patient2._id.toString(), {
        trigger: 'seeding',
        batchId: `seeding-${Date.now()}`
      });
      
      console.log('Medical analysis jobs scheduled for seeded data');
    } catch (error) {
      console.warn('Failed to run medical analysis on seeded data:', error.message);
      // Don't fail the entire seeding process if medical analysis fails
    }

    console.log('Database seeded!');
    return { org1, caregiver: caregiverOneRecord, patients: [patient1, patient2], invoiceRecord, paymentMethods };
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Only run the function if this file is being executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

// Export the function so it can be imported elsewhere
module.exports = seedDatabase;