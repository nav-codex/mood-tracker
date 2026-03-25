document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('date');
    dateInput.valueAsDate = new Date();

    const scoreSlider = document.getElementById('score');
    const scoreValue = document.getElementById('scoreValue');
    scoreSlider.addEventListener('input', (e) => {
        scoreValue.textContent = e.target.value;
    });

    const tags = document.querySelectorAll('.tag');
    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            tag.classList.toggle('selected');
        });
    });

    const form = document.getElementById('moodForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('.btn-submit');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        const date = document.getElementById('date').value;
        const score = document.getElementById('score').value;
        const note = document.getElementById('note').value;
        
        const selectedEmotions = Array.from(document.querySelectorAll('.tag.selected')).map(t => t.dataset.val);

        const data = {
            date,
            score: parseInt(score),
            emotions: selectedEmotions,
            note
        };

        try {
            const res = await fetch('/api/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                await fetchDashboardData();
                submitBtn.textContent = 'Saved!';
                setTimeout(() => {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }, 2000);
            } else {
                alert("Failed to save entry.");
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error saving:', error);
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    let moodChart = null;

    async function fetchDashboardData() {
        try {
            const [statsRes, entriesRes] = await Promise.all([
                fetch('/api/stats'),
                fetch('/api/entries')
            ]);
            
            const stats = await statsRes.json();
            const entries = await entriesRes.json();

            updateStats(stats);
            updateChart(entries);
            updateEmotions(stats.common_emotions);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }

    function updateStats(stats) {
        document.getElementById('statAvg').textContent = stats.average_score || '--';
        document.getElementById('statStreak').innerHTML = `${stats.best_streak} <span class="stat-sub">days</span>`;
        document.getElementById('statWorstDay').textContent = stats.worst_day || '--';
    }

    function updateChart(entries) {
        if (!entries || entries.length === 0) return;

        const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        const recent = sorted.slice(-14);
        
        const labels = recent.map(e => {
            const d = new Date(e.date);
            return `${d.getMonth()+1}/${d.getDate()}`;
        });
        const data = recent.map(e => e.score);

        const ctx = document.getElementById('moodChart').getContext('2d');
        
        if (moodChart) {
            moodChart.destroy();
        }

        moodChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Mood Score',
                    data: data,
                    borderColor: '#86a789',
                    backgroundColor: 'rgba(134, 167, 137, 0.2)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#86a789',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Score: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 10,
                        grid: {
                            color: 'rgba(0,0,0,0.05)',
                            drawBorder: false,
                        },
                        ticks: {
                            stepSize: 2,
                            font: { family: "'Plus Jakarta Sans', sans-serif" }
                        }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: {
                            font: { family: "'Plus Jakarta Sans', sans-serif" }
                        }
                    }
                }
            }
        });
    }

    function updateEmotions(emotions) {
        const container = document.getElementById('commonEmotions');
        container.innerHTML = '';
        
        if (!emotions || emotions.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">No data yet.</p>';
            return;
        }

        emotions.forEach(e => {
            const div = document.createElement('div');
            div.className = 'emotion-item';
            div.innerHTML = `
                <span class="emotion-name">${e.emotion}</span>
                <span class="emotion-count">${e.count}x</span>
            `;
            container.appendChild(div);
        });
    }

    fetchDashboardData();
});
