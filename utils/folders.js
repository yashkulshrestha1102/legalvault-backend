const ALL_FOLDERS = [
  { id: 'registrations', label: 'Registrations / Certifications', group: 'Main' },
  { id: 'contracts', label: 'Contracts', group: 'Main' },
  { id: 'policies', label: 'Policies', group: 'Main' },
  { id: 'corporate-secretariat', label: 'Corporate Secretariat', group: 'Main' },
  { id: 'hr', label: 'HR', group: 'Main' },
  { id: 'gst', label: 'GST', group: 'Main' },
  { id: 'income-tax', label: 'Income Tax', group: 'Main' },
  { id: 'financials', label: 'Financials', group: 'Main' }
];

// Folder IDs array (for quick checks)
const FOLDER_IDS = ALL_FOLDERS.map(f => f.id);

module.exports = { ALL_FOLDERS, FOLDER_IDS };