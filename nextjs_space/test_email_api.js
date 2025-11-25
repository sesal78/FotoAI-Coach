const fetch = require('node-fetch');

const testEmail = async () => {
  console.log('Testing email API endpoint...\n');
  
  const payload = {
    challengeText: "Test Challenge: Urban Reflections",
    category: "STREET",
    difficulty: "INTERMEDIATE",
    duration: "1 hour",
    location: "Melbourne CBD",
    recommendedGear: "Fujifilm X-T5 with 23mm f/2",
    tips: "Look for reflections in windows and puddles",
    weatherConditions: "Partly cloudy",
    detailedDescription: "Explore the city and capture interesting reflections in glass buildings, puddles, and mirrors.",
    userEmail: "seun_salami@outlook.com"
  };

  try {
    console.log('Sending request to: http://localhost:3000/api/challenges/email');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('\n');
    
    const response = await fetch('http://localhost:3000/api/challenges/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Email sent successfully!');
    } else {
      console.log('\n❌ Email failed!');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
};

testEmail();
