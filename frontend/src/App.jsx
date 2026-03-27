import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Upload, FileText, Download, CheckCircle, AlertCircle, Play, Printer, FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const API_BASE = 'http://localhost:8000/api';

function App() {
  const [topics, setTopics] = useState([]);
  const [types, setTypes] = useState([]);
  const [dbStats, setDbStats] = useState(null);
  const [sections, setSections] = useState([]);
  const [examResult, setExamResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Topic Question Explorer State
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [topicQuestions, setTopicQuestions] = useState({});
  const [topicFilter, setTopicFilter] = useState('ALL');
  
  // Settings
  const [showAnswers, setShowAnswers] = useState(false);

  // Upload state
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadTopic, setUploadTopic] = useState('');
  const [uploadType, setUploadType] = useState('AUTO');
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const [useCustomType, setUseCustomType] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const res = await axios.get(`${API_BASE}/topics`);
      const { topics: rawTopics, types, stats } = res.data;
      
      const sortedTopics = (rawTopics || []).sort((a, b) => {
        // Sort numerically e.g. "TOPIC 1" vs "TOPIC 10"
        const numA = parseInt(a.match(/\d+/) || [0], 10);
        const numB = parseInt(b.match(/\d+/) || [0], 10);
        if (numA === numB) return a.localeCompare(b);
        return numA - numB;
      });
      
      setTopics(sortedTopics);
      if (types && types.length > 0) setTypes(types);
      setDbStats(stats);
    } catch (err) {
      console.error('Failed to fetch metadata', err);
      setTopics(['TOPIC 1', 'TOPIC 2', 'TOPIC 3', 'TOPIC 4']);
      setTypes(['MCQ', 'ESSAY']);
    }
  };

  const toggleTopic = async (topic) => {
    if (expandedTopic === topic) {
      setExpandedTopic(null);
      return;
    }
    
    setExpandedTopic(topic);
    
    if (!topicQuestions[topic]) {
      try {
        const res = await axios.get(`${API_BASE}/questions`, { params: { topic } });
        setTopicQuestions(prev => ({ ...prev, [topic]: res.data }));
      } catch (err) {
        console.error("Failed to fetch questions for topic", err);
      }
    }
  };

  const addSection = () => {
    setSections([...sections, {
      topic: topics[0] || 'TOPIC 1',
      type: types[0] || 'MCQ',
      count: 10
    }]);
  };

  const removeSection = (index) => {
    const newSections = [...sections];
    newSections.splice(index, 1);
    setSections(newSections);
  };

  const updateSection = (index, field, value) => {
    const newSections = [...sections];
    newSections[index][field] = value;
    setSections(newSections);
  };

  const handleGenerate = async () => {
    if (sections.length === 0) {
      setError("Please add at least one section requirement.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setExamResult(null);
    
    try {
      const res = await axios.post(`${API_BASE}/generate`, {
        requirements: sections.map(s => ({
          ...s,
          count: parseInt(s.count) || 0
        }))
      });
      setExamResult(res.data.exam);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Failed to generate exam.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    if (!uploadTopic) {
      setError("Please specify a topic name for the upload");
      return;
    }
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadStatus('Uploading...');
    setError(null);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        params: { topic: uploadTopic, q_type: uploadType },
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStatus(`Success! Added ${res.data.added_count} questions.`);
      fetchMetadata(); // Refresh topics
      
      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadStatus('Upload failed');
      const msg = err.response?.data?.detail || err.message || "Failed to upload file.";
      setError(msg);
    }
  };

  const isArabic = (text) => {
    const arabicRegex = /[\u0600-\u06FF]/;
    return arabicRegex.test(text);
  };

  const cleanFormat = (text) => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  };

  const downloadText = () => {
    if (!examResult) return;
    let content = "";
    examResult.forEach((q, idx) => {
      content += `${idx + 1}. ${cleanFormat(q.text)}\n\n`;
    });
    
    const hasAnswers = examResult.some(q => q.answer);
    if (hasAnswers && showAnswers) {
      content += "*** ANSWER KEY ***\n=================\n\n";
      examResult.forEach((q, idx) => {
        if (q.answer) {
          content += `Q${idx + 1}: ${q.answer}\n`;
        }
      });
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Generated_Exam.txt";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadPDF = () => {
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#000';
    
    examResult.forEach((q, idx) => {
      const qDiv = document.createElement('div');
      qDiv.style.marginBottom = '25px';
      
      const textDiv = document.createElement('div');
      textDiv.dir = isArabic(q.text) ? "rtl" : "ltr";
      textDiv.style.textAlign = isArabic(q.text) ? "right" : "left";
      textDiv.style.fontSize = "14px";
      textDiv.style.whiteSpace = "pre-wrap";
      textDiv.innerText = `${idx + 1}. ${cleanFormat(q.text)}`;
      
      qDiv.appendChild(textDiv);
      container.appendChild(qDiv);
    });
    
    if (showAnswers && examResult.some(q => q.answer)) {
      const ansHeader = document.createElement('h3');
      ansHeader.innerText = "Answer Key";
      ansHeader.style.marginTop = "30px";
      ansHeader.style.paddingTop = "15px";
      ansHeader.style.borderTop = "1px solid #ccc";
      container.appendChild(ansHeader);
      
      examResult.forEach((q, idx) => {
        if (q.answer) {
          const aDiv = document.createElement('div');
          aDiv.innerText = `${idx + 1}. ${q.answer}`;
          aDiv.style.marginBottom = "8px";
          aDiv.style.fontSize = "13px";
          container.appendChild(aDiv);
        }
      });
    }

    html2pdf().set({
      margin: 15,
      filename: 'Exam.pdf',
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save();
  };

  return (
    <div className="container fade-in">
      <header className="header">
        <h1>Exam Generator Pro</h1>
        <p>Instantly compile randomized exams from your document archives</p>
      </header>

      {error && (
        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', borderLeft: '4px solid var(--error-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle color="var(--error-color)" />
          <span style={{ color: '#fca5a5' }}>{error}</span>
        </div>
      )}

      {dbStats && (
        <div className="glass-panel fade-in" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'linear-gradient(to right, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--primary-color)" /> Database Overview
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', minWidth: '150px', borderLeft: '4px solid #818cf8' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Total Questions</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#818cf8' }}>{dbStats.total_questions}</div>
            </div>
            
            {types.map(ty => (
              <div key={ty} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', minWidth: '120px', borderLeft: '4px solid #34d399' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{ty}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{dbStats.type_counts?.[ty] || 0}</div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#cbd5e1' }}>Explore Questions by Topic (Click to Expand)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {topics.map(t => (
              <div key={t} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden', transition: 'all 0.2s', border: expandedTopic === t ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent' }}>
                <div 
                  onClick={() => toggleTopic(t)}
                  style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: expandedTopic === t ? 'rgba(99, 102, 241, 0.15)' : 'transparent', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}
                >
                  <span style={{ color: expandedTopic === t ? 'var(--primary-color)' : 'var(--text-main)', fontWeight: '600' }}>{t}</span>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Render Category Breakdown inside Topic Header */}
                    {Object.entries(dbStats.topic_stats?.[t]?.types || {}).map(([ty, count]) => (
                      <span key={ty} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#cbd5e1' }}>
                        {ty}: <strong style={{ color: '#fff' }}>{count}</strong>
                      </span>
                    ))}
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      {dbStats.topic_stats?.[t]?.total || 0} Total {expandedTopic === t ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
                
                {expandedTopic === t && (
                  <div className="fade-in" style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)', maxHeight: '350px', overflowY: 'auto' }}>
                    
                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setTopicFilter('ALL'); }} 
                        style={{ padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.8rem', background: topicFilter === 'ALL' ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', transition: '0.2s' }}
                      >All</button>
                      {types.map(ty => (
                        <button 
                          key={ty}
                          onClick={(e) => { e.stopPropagation(); setTopicFilter(ty); }} 
                          style={{ padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.8rem', background: topicFilter === ty ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', transition: '0.2s' }}
                        >{ty}</button>
                      ))}
                    </div>

                    {topicQuestions[t] ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {topicQuestions[t].filter(q => topicFilter === 'ALL' || q.type === topicFilter).map((q, idx) => (
                          <div key={idx} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: `3px solid var(--primary-color)` }}>
                            <div style={{ fontSize: '0.75rem', color: '#818cf8', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 'bold' }}>{q.type}</div>
                            <div 
                              dir={isArabic(q.text) ? "rtl" : "ltr"} 
                              style={{ textAlign: isArabic(q.text) ? 'right' : 'left', fontSize: '0.95rem', whiteSpace: 'pre-wrap', color: '#f8fafc', lineHeight: '1.6' }}
                            >
                              {q.text}
                            </div>
                            {q.answer && (
                              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                <strong>Answer:</strong> {q.answer}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Left Column: Requirements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>1. Define Exam Sections</h2>
              <button className="btn-secondary" onClick={addSection} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
                <Plus size={18} /> Add Section
              </button>
            </div>

            {sections.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                No sections defined. Click "Add Section" to start building your exam.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sections.map((sec, idx) => (
                  <div key={idx} className="req-row fade-in">
                    <div>
                      <select value={sec.topic} onChange={(e) => updateSection(idx, 'topic', e.target.value)}>
                        {topics.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <select value={sec.type} onChange={(e) => updateSection(idx, 'type', e.target.value)}>
                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <input 
                        type="number" 
                        min="1" 
                        value={sec.count} 
                        onChange={(e) => updateSection(idx, 'count', e.target.value)}
                        placeholder="Qty"
                      />
                    </div>
                    <button className="btn-icon-danger" onClick={() => removeSection(idx)}>
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button className="btn-primary" onClick={handleGenerate} disabled={loading || sections.length === 0} style={{ width: '100%' }}>
                {loading ? <div className="spinner" /> : <Play size={20} />}
                {loading ? 'Generating...' : 'Generate Exam'}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Upload & Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2>2. Upload Custom Files</h2>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>Include new questions to your database dynamically (.pdf, .docx, .txt)</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                {useCustomTopic ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="Custom Topic Name..." 
                      value={uploadTopic}
                      onChange={(e) => setUploadTopic(e.target.value)}
                      style={{ padding: '0.75rem', flex: 1 }}
                    />
                    <button className="btn-secondary" onClick={() => { setUseCustomTopic(false); setUploadTopic(topics[0] || ''); }} style={{ padding: '0.75rem' }}>Cancel</button>
                  </div>
                ) : (
                  <select 
                    value={topics.includes(uploadTopic) ? uploadTopic : (uploadTopic === '' ? '' : 'ADD_NEW')}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setUseCustomTopic(true);
                        setUploadTopic('');
                      } else {
                        setUploadTopic(e.target.value);
                      }
                    }}
                    style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.5)', width: '100%', fontSize: '1rem' }}
                  >
                    <option value="" disabled>Select Topic...</option>
                    {topics.map(t => <option key={t} value={t}>{t} ({dbStats?.topic_stats?.[t]?.total || 0} Qs)</option>)}
                    <option value="ADD_NEW">+ Create Custom Topic</option>
                  </select>
                )}
              </div>
              
              <div>
                {useCustomType ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="Custom Type..." 
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value)}
                      style={{ padding: '0.75rem', flex: 1 }}
                    />
                    <button className="btn-secondary" onClick={() => { setUseCustomType(false); setUploadType('MCQ'); }} style={{ padding: '0.75rem' }}>Cancel</button>
                  </div>
                ) : (
                  <select 
                    value={types.includes(uploadType) || uploadType === 'AUTO' ? uploadType : 'ADD_NEW'}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setUseCustomType(true);
                        setUploadType('');
                      } else {
                        setUploadType(e.target.value);
                      }
                    }}
                    style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.5)', width: '100%', fontSize: '1rem' }}
                  >
                    <option value="AUTO">✨ Auto-Detect Type</option>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="ADD_NEW">+ Custom Type</option>
                  </select>
                )}
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".pdf,.docx,.txt" 
              onChange={handleFileChange} 
            />
            
            <div className="upload-zone" onClick={handleUploadClick}>
              <Upload size={32} color="var(--primary-color)" style={{ margin: '0 auto 1rem auto' }} />
              <div style={{ fontWeight: '500', color: '#e2e8f0', marginBottom: '0.5rem' }}>Click to Browse Files</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Supported formats: PDF, DOCX, TXT</div>
            </div>
            
            {uploadStatus && (
              <div style={{ marginTop: '1rem', color: uploadStatus.includes('Success') ? 'var(--success-color)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <CheckCircle size={16} /> {uploadStatus}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Generated Exam Result */}
      {examResult && (
        <div id="exam-preview" className="glass-panel fade-in" style={{ padding: '2rem', marginTop: '2rem', background: 'var(--bg-gradient-start)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2>Generated Exam ({examResult.length} Questions)</h2>
            <div id="exam-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '1rem', fontSize: '0.9rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.75rem', borderRadius: '6px' }}>
                <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
                Include Answer Key
              </label>
              <button className="btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                <Printer size={16} /> Print
              </button>
              <button className="btn-secondary" onClick={downloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                <FileDown size={16} /> Export PDF
              </button>
              <button className="btn-secondary" onClick={downloadText} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                <Download size={16} /> Save TXT
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {examResult.map((q, idx) => (
              <div key={idx} style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Question {idx + 1}</span>
                  <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {q.topic} - {q.type}
                  </span>
                </div>
                <div 
                  style={{ 
                    whiteSpace: 'pre-wrap', 
                    color: '#f8fafc', 
                    fontSize: '1.05rem', 
                    lineHeight: '1.6',
                    textAlign: isArabic(q.text) ? 'right' : 'left'
                  }} 
                  dir={isArabic(q.text) ? "rtl" : "ltr"}
                >
                  {cleanFormat(q.text)}
                </div>
              </div>
            ))}
          </div>

          {(showAnswers && examResult.some(q => q.answer)) && (
            <div style={{ marginTop: '2.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
              <h3 style={{ marginBottom: '1rem', color: '#e2e8f0' }}>Answer Key</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {examResult.map((q, idx) => q.answer ? (
                  <div key={`ans-${idx}`} style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', marginRight: '0.5rem' }}>Q{idx + 1}:</span>
                    <span style={{ color: 'var(--text-muted)' }}>{q.answer}</span>
                  </div>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden Print Container for native printing */}
      <div id="print-container" style={{ display: 'none' }}>
        {examResult?.map((q, idx) => (
          <div key={`print-${idx}`} style={{ marginBottom: '25px', fontFamily: 'Arial, sans-serif' }}>
            <div dir={isArabic(q.text) ? "rtl" : "ltr"} style={{ textAlign: isArabic(q.text) ? "right" : "left", whiteSpace: 'pre-wrap', fontSize: '14px' }}>
              {idx + 1}. {cleanFormat(q.text)}
            </div>
          </div>
        ))}
        {showAnswers && examResult?.some(q => q.answer) && (
          <div style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #ccc', fontFamily: 'Arial, sans-serif' }}>
            <h3>Answer Key</h3>
            {examResult.map((q, idx) => q.answer && (
              <div key={`print-ans-${idx}`} style={{ marginBottom: '8px', fontSize: '14px' }}>{idx + 1}. {q.answer}</div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default App;
