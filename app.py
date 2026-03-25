import os
import json
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DATA_FILE = "data/entries.json"

def load_entries():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_entries(entries):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(entries, f, indent=4)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/entries', methods=['GET'])
def get_entries():
    entries = load_entries()
    entries.sort(key=lambda x: x['date'], reverse=True)
    return jsonify(entries)

@app.route('/api/entries', methods=['POST'])
def add_entry():
    data = request.json
    entries = load_entries()
    
    if 'date' not in data or 'score' not in data:
        return jsonify({"error": "Missing date or score"}), 400
        
    existing = next((e for e in entries if e['date'] == data['date']), None)
    
    if existing:
        existing['score'] = int(data['score'])
        existing['emotions'] = data.get('emotions', [])
        existing['note'] = data.get('note', '')
    else:
        entry = {
            "id": str(uuid.uuid4()),
            "date": data['date'],
            "score": int(data['score']),
            "emotions": data.get('emotions', []),
            "note": data.get('note', '')
        }
        entries.append(entry)
        
    save_entries(entries)
    return jsonify({"success": True})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    entries = load_entries()
    if not entries:
        return jsonify({
            "worst_day": "-",
            "best_streak": 0,
            "common_emotions": [],
            "average_score": 0
        })

    avg_score = sum(e['score'] for e in entries) / len(entries)

    from collections import defaultdict
    day_scores = defaultdict(list)
    for e in entries:
        dt = datetime.strptime(e['date'], "%Y-%m-%d")
        day_name = dt.strftime("%A")
        day_scores[day_name].append(e['score'])
    
    worst_day_name = "-"
    lowest_avg = 11
    for day, scores in day_scores.items():
        avg = sum(scores) / len(scores)
        if avg < lowest_avg:
            lowest_avg = avg
            worst_day_name = day
            
    emotion_counts = defaultdict(int)
    for e in entries:
        for em in e['emotions']:
            emotion_counts[em] += 1
    
    common_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    common_emotions_list = [{"emotion": k, "count": v} for k, v in common_emotions]
    
    sorted_entries = sorted(entries, key=lambda x: x['date'])
    best_streak = 0
    current_streak = 0
    
    if sorted_entries:
        prev_date = datetime.strptime(sorted_entries[0]['date'], "%Y-%m-%d")
        if sorted_entries[0]['score'] >= 7:
            current_streak = 1
            best_streak = 1
            
        for e in sorted_entries[1:]:
            curr_date = datetime.strptime(e['date'], "%Y-%m-%d")
            score = e['score']
            
            days_diff = (curr_date - prev_date).days
            
            if score >= 7:
                if days_diff == 1:
                    current_streak += 1
                elif days_diff > 1:
                    current_streak = 1
            else:
                current_streak = 0
                
            best_streak = max(best_streak, current_streak)
            prev_date = curr_date

    return jsonify({
        "worst_day": worst_day_name,
        "best_streak": best_streak,
        "common_emotions": common_emotions_list,
        "average_score": round(avg_score, 1)
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
