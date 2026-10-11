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
    const data = await res.json();
    renderPointsTable(data.pointsTable || []);
    const s = data.summary || data.databaseSummary;
    if (s) {
      matchesCount.textContent = `${s.match_details ?? s.matches ?? 0} Matches`;
    }
  } catch (err) {
    console.warn('Failed to load stats:', err);
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
    const data = await res.json();
    loadingDiv.remove();

    if (data.success) {
      appendBotResponse(data);
    } else {
      appendBotError(data.error);
    }
  } catch (err) {
    loadingDiv.remove();
    appendBotError(err.message);
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

function appendBotError(errorMsg) {
  const div = document.createElement('div');
  div.className = 'chat-bubble bot';
  div.innerHTML = `<p style="color: #f87171;">❌ <strong>Error:</strong> ${escapeHtml(errorMsg)}</p>`;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

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
