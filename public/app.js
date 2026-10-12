/**
 * ==============================================================================
 * CLIENT APPLICATION LOGIC (public/app.js)
 * ==============================================================================
 */

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatHistory = document.getElementById('chat-history');
const askBtn = document.getElementById('ask-btn');

const pointsBody = document.getElementById('points-body');
const matchesCount = document.getElementById('matches-count');

// Load initial points table & stats
document.addEventListener('DOMContentLoaded', () => {
  fetchStats();
});

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderPointsTable(data.pointsTable || []);
    const s = data.summary || data.databaseSummary;
    if (s) {
      matchesCount.textContent = `${s.match_details ?? s.matches ?? 0} Matches`;
    }
  } catch (err) {
    console.warn('Failed to load stats:', err);
    pointsBody.innerHTML = '<tr><td colspan="6" class="loading" style="color: #fca5a5;">⚠️ Standings loading paused — server waking up or connecting...</td></tr>';
  }
}

function renderPointsTable(standings) {
  pointsBody.innerHTML = '';
  if (!standings || standings.length === 0) {
    pointsBody.innerHTML = '<tr><td colspan="6" class="loading">No standings data.</td></tr>';
    return;
  }

  standings.forEach((row, i) => {
    const nrrVal = parseFloat(row.nrr ?? 0);
    const nrrFormatted = (nrrVal > 0 ? '+' : '') + nrrVal.toFixed(3);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(row.short_name || row.team_name)}</strong></td>
      <td>${row.matches_played ?? 0}</td>
      <td>${row.wins ?? 0}</td>
      <td>${row.losses ?? 0}</td>
      <td><strong>${row.points ?? 0}</strong></td>
      <td style="color: ${nrrVal > 0 ? '#34d399' : (nrrVal < 0 ? '#f87171' : 'inherit')}; font-weight: 600;">${nrrFormatted}</td>
    `;
    pointsBody.appendChild(tr);
  });
}

// Handle Natural Language Question
async function handleChatSubmit(e) {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  chatInput.value = '';
  appendUserMessage(question);

  // Loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-bubble bot';
  loadingDiv.innerHTML = '<p>⏳ <em>Formulating SQL & querying database...</em></p>';
  chatHistory.appendChild(loadingDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  askBtn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    if (!res.ok) {
      let errText = `Server HTTP ${res.status}: ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.error) {
          errText = errJson.error;
        }
      } catch (_) {}
      throw new Error(errText);
    }

    const data = await res.json();
    loadingDiv.remove();

    if (data.success) {
      appendBotResponse(data);
    } else {
      appendBotError(data.error || 'Failed to process question.', question);
    }
  } catch (err) {
    loadingDiv.remove();
    appendBotError(err.message, question);
  } finally {
    askBtn.disabled = false;
  }
}

function appendUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-bubble user';
  div.textContent = text;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendBotResponse(data) {
  const div = document.createElement('div');
  div.className = 'chat-bubble bot';

  let html = `<p>${formatMarkdown(data.answer)}</p>`;

  // Show generated SQL query
  if (data.sql) {
    html += `
      <div class="sql-card">
        <div class="sql-header">
          <span>GENERATED SQL (${escapeHtml(data.provider || 'AI')})</span>
        </div>
        <pre class="sql-code">${escapeHtml(data.sql)}</pre>
      </div>
    `;
  }

  // Show data rows table
  if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
    const headers = Object.keys(data.rows[0]);
    html += `
      <div class="result-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${data.rows
              .map(
                (r) =>
                  `<tr>${headers
                    .map((h) => `<td>${escapeHtml(String(r[h] ?? 'NULL'))}</td>`)
                    .join('')}</tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  div.innerHTML = html;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendBotError(errorMsg, failedQuestion = '') {
  const div = document.createElement('div');
  div.className = 'chat-bubble bot error-bubble';

  const isNetwork = /fetch|network|failed to fetch|load failed|econnrefused|enotfound/i.test(errorMsg);

  let html = `
    <div class="error-card">
      <div class="error-header">
        <span class="error-icon">⚠️</span>
        <strong class="error-title">${isNetwork ? 'Connection / Server Unreachable' : 'Query Execution Error'}</strong>
      </div>
      <div class="error-body">
        <p class="error-msg">${isNetwork ? 'Could not connect to the backend server.' : escapeHtml(errorMsg)}</p>
  `;

  if (isNetwork) {
    html += `
      <div class="error-troubleshoot">
        <strong>💡 Common causes & quick fixes:</strong>
        <ul>
          <li><strong>Render Free-Tier Spin-Up:</strong> If hosted on Render free tier, web services sleep after 15 mins of inactivity. Cold starts take <strong>40–60 seconds</strong>. Please give it a few moments and hit Retry below!</li>
          <li><strong>Local Server:</strong> If running locally, verify that <code>node src/server.js</code> or <code>npm start</code> is running in your terminal on port 3000.</li>
          <li><strong>Network Connection:</strong> Check your internet connectivity or browser developer console (<code>F12</code>).</li>
        </ul>
      </div>
    `;
  }

  if (failedQuestion) {
    html += `
      <div class="error-actions">
        <button type="button" class="btn btn-retry" onclick="retryQuestion(${escapeHtml(JSON.stringify(failedQuestion))})">
          🔄 Retry Query
        </button>
      </div>
    `;
  }

  html += `
      <details class="error-details">
        <summary>Technical Details</summary>
        <code>${escapeHtml(errorMsg)}</code>
      </details>
    </div>
  </div>`;

  div.innerHTML = html;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Retry question function
window.retryQuestion = function(text) {
  if (!text) return;
  chatInput.value = text;
  chatForm.dispatchEvent(new Event('submit'));
};

// Quick Chips
function askQuick(text) {
  chatInput.value = text;
  chatForm.dispatchEvent(new Event('submit'));
}


function formatMarkdown(str) {
  if (!str) return '';
  return escapeHtml(str)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
