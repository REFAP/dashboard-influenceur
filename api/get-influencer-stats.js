export default async function handler(req, res) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ref } = req.query;
    
    if (!ref) {
      return res.status(400).json({ error: 'Missing influencer ref parameter' });
    }

    console.log('📊 Récupération stats pour:', ref);

    // URL de votre base Airtable (à remplacer par votre vraie URL)
    const airtableBaseUrl = 'https://api.airtable.com/v0/appGeEstBq3KYfqcq';
    const airtableToken = process.env.AIRTABLE_TOKEN; // À configurer dans Vercel
    
    // Si pas de token Airtable, retourner des données simulées pour test
    if (!airtableToken) {
      console.log('⚠️ AIRTABLE_TOKEN manquant, utilisation de données simulées');
      return res.status(200).json(getSimulatedData(ref));
    }

    // Récupérer les infos de l'influenceur
    const influencerResponse = await fetch(`${airtableBaseUrl}/Influenceurs/${ref}`, {
      headers: {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!influencerResponse.ok) {
      console.log('❌ Influenceur non trouvé:', ref);
      return res.status(404).json({ error: 'Influencer not found' });
    }

    const influencerData = await influencerResponse.json();
    
    // Récupérer les leads de cet influenceur
    const leadsResponse = await fetch(`${airtableBaseUrl}/Leads?filterByFormula={Influenceur}="${ref}"`, {
      headers: {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json'
      }
    });

    const leadsData = await leadsResponse.json();
    const leads = leadsData.records || [];

    // Calculer les statistiques
    const stats = calculateStats(influencerData.fields, leads);
    
    console.log('✅ Stats calculées pour:', ref);
    return res.status(200).json(stats);

  } catch (error) {
    console.error('💥 Erreur API stats:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}

// Fonction pour calculer les statistiques depuis les données Airtable
function calculateStats(influencer, leads) {
  const totalLeads = leads.length;
  const paidLeads = leads.filter(lead => 
    lead.fields['Statut paiement'] === 'Payé'
  ).length;
  
  const totalEarnings = leads.reduce((sum, lead) => {
    return sum + (lead.fields.Commission || 0);
  }, 0);

  const paidEarnings = leads.filter(lead => 
    lead.fields['Statut paiement'] === 'Payé'
  ).reduce((sum, lead) => {
    return sum + (lead.fields.Commission || 0);
  }, 0);

  const pendingEarnings = totalEarnings - paidEarnings;

  // Simuler les clics (à remplacer par vraies données si disponibles)
  const estimatedClicks = totalLeads * 30; // Estimation basée sur taux de conversion moyen

  return {
    influencer: {
      id: influencer.id,
      name: `${influencer.Prénom || ''} ${influencer.Nom || ''}`.trim(),
      email: influencer.Email,
      platform: influencer['Plateforme principale'],
      followers: influencer['Nombre d\'abonnés'],
      ref: influencer.id
    },
    stats: {
      totalClicks: estimatedClicks,
      conversions: totalLeads,
      totalEarnings: totalEarnings,
      paidEarnings: paidEarnings,
      pendingEarnings: pendingEarnings,
      conversionRate: estimatedClicks > 0 ? ((totalLeads / estimatedClicks) * 100).toFixed(1) : 0
    },
    recentLeads: leads.slice(-10).map(lead => ({
      date: lead.createdTime,
      amount: lead.fields.Commission || 25,
      status: lead.fields['Statut paiement'] || 'En attente',
      qualified: lead.fields['Lead qualifié'] || false
    })),
    monthlyData: generateMonthlyData(leads) // Pour le graphique
  };
}

// Données simulées pour les tests
function getSimulatedData(ref) {
  const names = {
    'recTEST123': 'Marie Dubois',
    'recABC123': 'Thomas Martin', 
    'recDEF456': 'Sophie Bernard'
  };

  const name = names[ref] || 'Influenceur Test';
  const baseClicks = Math.floor(Math.random() * 1000) + 500;
  const conversions = Math.floor(baseClicks * 0.035);

  return {
    influencer: {
      id: ref,
      name: name,
      email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
      platform: 'Instagram',
      followers: Math.floor(Math.random() * 50000) + 10000,
      ref: ref
    },
    stats: {
      totalClicks: baseClicks,
      conversions: conversions,
      totalEarnings: conversions * 25,
      paidEarnings: Math.floor(conversions * 0.7) * 25,
      pendingEarnings: Math.ceil(conversions * 0.3) * 25,
      conversionRate: 3.5
    },
    recentLeads: [
      { date: '2025-07-27', amount: 200, status: 'En attente', qualified: true },
      { date: '2025-07-15', amount: 300, status: 'Payé', qualified: true },
      { date: '2025-07-01', amount: 350, status: 'Payé', qualified: true }
    ],
    monthlyData: [20, 25, 30, 28, 35, 42, 38, 45, 40, conversions]
  };
}

// Générer données mensuelles pour le graphique
function generateMonthlyData(leads) {
  const monthlyData = new Array(10).fill(0);
  const now = new Date();
  
  leads.forEach(lead => {
    const leadDate = new Date(lead.createdTime);
    const monthsAgo = Math.floor((now - leadDate) / (1000 * 60 * 60 * 24 * 30));
    
    if (monthsAgo >= 0 && monthsAgo < 10) {
      monthlyData[9 - monthsAgo]++;
    }
  });
  
  return monthlyData;
}
