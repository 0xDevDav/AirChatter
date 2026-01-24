// Global variables
let modelProfiles = {};
let editingModel = null;

// Helper functions for Bootstrap visibility
const show = el => el.classList.remove('d-none');
const hide = el => el.classList.add('d-none');

// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['aiProvider', 'claudeApiKey', 'claudeModel', 'openaiApiKey', 'openaiModel', 'multipleResponses'], (result) => {
    const provider = result.aiProvider || 'claude';
    document.getElementById('aiProvider').value = provider;
    toggleProviderSettings(provider);

    if (result.claudeApiKey) {
      document.getElementById('apiKey').value = result.claudeApiKey;
    }
    document.getElementById('modelSelect').value = result.claudeModel || 'claude-opus-4-20250514';

    if (result.openaiApiKey) {
      document.getElementById('openaiApiKey').value = result.openaiApiKey;
    }
    document.getElementById('openaiModel').value = result.openaiModel || 'gpt-4o';

    document.getElementById('multipleResponses').checked = result.multipleResponses || false;
  });

  chrome.storage.sync.get(['modelProfiles'], (result) => {
    if (result.modelProfiles) {
      modelProfiles = result.modelProfiles;
    }
    renderModelList();
  });

  // Event listeners
  document.getElementById('aiProvider').addEventListener('change', (e) => toggleProviderSettings(e.target.value));
  document.getElementById('addModelBtn').addEventListener('click', showAddForm);
  document.getElementById('optimizeBtn').addEventListener('click', optimizeInfo);
  document.getElementById('saveModelBtn').addEventListener('click', saveModel);
  document.getElementById('cancelModelBtn').addEventListener('click', hideAddForm);
  document.getElementById('exportBtn').addEventListener('click', exportProfiles);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importProfiles);
});

function toggleProviderSettings(provider) {
  const claude = document.getElementById('claudeSettings');
  const openai = document.getElementById('openaiSettings');
  provider === 'claude' ? (show(claude), hide(openai)) : (hide(claude), show(openai));
}

document.getElementById('saveBtn').addEventListener('click', () => {
  const provider = document.getElementById('aiProvider').value;
  const statusEl = document.getElementById('status');
  const multipleResponses = document.getElementById('multipleResponses').checked;

  if (provider === 'claude') {
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('modelSelect').value;

    if (!apiKey) {
      showStatus(statusEl, 'Please enter a valid API key', 'danger');
      return;
    }
    if (!apiKey.startsWith('sk-ant-')) {
      showStatus(statusEl, 'Claude API key must start with "sk-ant-"', 'danger');
      return;
    }

    chrome.storage.sync.set({ aiProvider: provider, claudeApiKey: apiKey, claudeModel: model, multipleResponses }, () => {
      showStatus(statusEl, 'Settings saved successfully!', 'success', true);
    });
  } else {
    const apiKey = document.getElementById('openaiApiKey').value.trim();
    const model = document.getElementById('openaiModel').value;

    if (!apiKey) {
      showStatus(statusEl, 'Please enter a valid API key', 'danger');
      return;
    }
    if (!apiKey.startsWith('sk-')) {
      showStatus(statusEl, 'OpenAI API key must start with "sk-"', 'danger');
      return;
    }

    chrome.storage.sync.set({ aiProvider: provider, openaiApiKey: apiKey, openaiModel: model, multipleResponses }, () => {
      showStatus(statusEl, 'Settings saved successfully!', 'success', true);
    });
  }
});

function showStatus(el, message, type, autoHide = false) {
  const icon = type === 'success' ? 'check-circle-fill' : 'exclamation-triangle';
  el.innerHTML = `<i class="bi bi-${icon} me-2"></i>${message}`;
  el.className = `alert alert-${type}`;
  show(el);
  if (autoHide) setTimeout(() => hide(el), 3000);
}

function renderModelList() {
  const listEl = document.getElementById('modelList');
  const names = Object.keys(modelProfiles);

  if (names.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-4">
        <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary opacity-50"></i>
        <span class="text-secondary small">No profiles configured</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = names.map(name => `
    <div class="model-item d-flex justify-content-between align-items-center p-2 rounded mb-2" data-name="${escapeHtml(name)}">
      <span class="fw-semibold text-info">
        <i class="bi bi-person-circle me-2"></i>${escapeHtml(name)}
      </span>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-primary edit-btn"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-outline-danger delete-btn"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => editModel(e.target.closest('.model-item').dataset.name));
  });

  listEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => deleteModel(e.target.closest('.model-item').dataset.name));
  });
}

function showAddForm() {
  show(document.getElementById('addModelForm'));
  hide(document.getElementById('addModelBtn'));
  document.getElementById('modelName').focus();
}

function hideAddForm() {
  hide(document.getElementById('addModelForm'));
  show(document.getElementById('addModelBtn'));
  document.getElementById('modelName').value = '';
  document.getElementById('modelName').disabled = false;
  document.getElementById('modelInfoRaw').value = '';
  hide(document.getElementById('organizeStatus'));
  editingModel = null;
}

function editModel(name) {
  const profile = modelProfiles[name];
  if (!profile) return;

  editingModel = name;
  document.getElementById('modelName').value = name;
  document.getElementById('modelName').disabled = true;
  document.getElementById('modelInfoRaw').value = profile.optimizedInfo || profile.rawInfo || '';
  showAddForm();
}

function deleteModel(name) {
  if (!confirm(`Delete profile "${name}"?`)) return;
  delete modelProfiles[name];
  chrome.storage.sync.set({ modelProfiles }, renderModelList);
}

async function optimizeInfo() {
  const name = document.getElementById('modelName').value.trim();
  const currentInfo = document.getElementById('modelInfoRaw').value.trim();
  const statusEl = document.getElementById('organizeStatus');
  const optimizeBtn = document.getElementById('optimizeBtn');
  const textarea = document.getElementById('modelInfoRaw');

  if (!currentInfo) {
    showStatus(statusEl, 'Please enter information to optimize first', 'warning');
    return;
  }

  const result = await chrome.storage.sync.get(['aiProvider', 'claudeApiKey', 'openaiApiKey']);
  const provider = result.aiProvider || 'claude';
  const hasApiKey = provider === 'claude' ? result.claudeApiKey : result.openaiApiKey;

  if (!hasApiKey) {
    showStatus(statusEl, 'Please configure API key first', 'warning');
    return;
  }

  const providerName = provider === 'claude' ? 'Claude' : 'ChatGPT';
  statusEl.innerHTML = `<div class="spinner-border spinner-border-sm me-2"></div>Optimizing with ${providerName}...`;
  statusEl.className = 'alert alert-info';
  show(statusEl);
  optimizeBtn.disabled = true;
  optimizeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Optimizing...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'organizeModelInfo',
      modelName: name,
      rawInfo: currentInfo
    });

    if (response.success) {
      textarea.value = response.data;
      textarea.classList.add('border-success');
      showStatus(statusEl, 'Optimized! Edit if needed, then click Save.', 'success');
    } else {
      showStatus(statusEl, response.error, 'danger');
    }
  } catch (error) {
    showStatus(statusEl, error.message, 'danger');
  }

  optimizeBtn.disabled = false;
  optimizeBtn.innerHTML = '<i class="bi bi-magic me-1"></i>Optimize with AI';
}

function saveModel() {
  const name = document.getElementById('modelName').value.trim();
  const currentInfo = document.getElementById('modelInfoRaw').value.trim();
  const statusEl = document.getElementById('organizeStatus');

  if (!name) {
    showStatus(statusEl, 'Please enter the model name', 'warning');
    return;
  }
  if (!currentInfo) {
    showStatus(statusEl, 'Please enter model information', 'warning');
    return;
  }

  modelProfiles[name] = { rawInfo: currentInfo, optimizedInfo: currentInfo };

  chrome.storage.sync.set({ modelProfiles }, () => {
    showStatus(statusEl, 'Profile saved!', 'success');
    setTimeout(() => {
      hideAddForm();
      renderModelList();
    }, 1000);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function exportProfiles() {
  const names = Object.keys(modelProfiles);
  if (names.length === 0) {
    alert('No profiles to export');
    return;
  }

  const blob = new Blob([JSON.stringify(modelProfiles, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `model-profiles-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProfiles(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);

      if (typeof imported !== 'object' || Array.isArray(imported)) {
        throw new Error('Invalid format');
      }

      const names = Object.keys(imported);
      if (names.length === 0) {
        alert('File contains no profiles');
        return;
      }

      const existingNames = Object.keys(modelProfiles);
      if (existingNames.length > 0 && !confirm(`You already have ${existingNames.length} profiles. Merge them?`)) {
        return;
      }

      modelProfiles = { ...modelProfiles, ...imported };
      chrome.storage.sync.set({ modelProfiles }, () => {
        renderModelList();
        alert(`Successfully imported ${names.length} profiles!`);
      });

    } catch (error) {
      alert('File error: ' + error.message);
    }
  };

  reader.readAsText(file);
  event.target.value = '';
}
