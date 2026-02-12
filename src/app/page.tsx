'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient' // 경로가 다르면 수정하세요!

interface Question {
  id: number;
  image_url: string;
  answer: string;
}

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('') 
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const options = ["1", "2", "3", "4", "5"];

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
    
    if (error) {
      console.error('데이터 호출 에러:', error.message)
    } else {
      setQuestions(data || [])
    }
    setLoading(false)
  }

  const checkAnswer = () => {
    const currentQuestion = questions[currentIndex];
    const isCorrect = selectedAnswer.trim() === currentQuestion.answer.toString().trim();

    if (isCorrect) {
      setMessage('✅ 정답입니다! 다음 문제로 넘어가세요.')
    } else {
      setMessage(`❌ 틀렸습니다. 정답은 ${currentQuestion.answer}번입니다.`)
    }
  }

  const nextQuestion = () => {
    setSelectedAnswer('')
    setMessage('')
    setCurrentIndex((prev) => (prev + 1) % questions.length)
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>데이터를 불러오는 중...</div>
  if (questions.length === 0) return <div style={{ padding: '40px', textAlign: 'center' }}>등록된 문제가 없습니다.</div>

  const currentQuiz = questions[currentIndex]

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <h1 style={{ marginBottom: '10px', fontSize: '24px' }}>🇰🇷 한국사 능력 검정 퀴즈</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>문제 {currentIndex + 1} / {questions.length}</p>

        {/* 문제 이미지 영역 */}
        <div style={{ width: '100%', marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
          {currentQuiz.image_url ? (
            <img 
              src={currentQuiz.image_url} 
              alt="한국사 문제" 
              style={{ width: '100%', maxWidth: '700px', height: 'auto' }} 
            />
          ) : (
            <div style={{ padding: '50px', border: '1px dashed #ccc' }}>이미지가 없습니다.</div>
          )}
        </div>

        {/* 5지선다 선택 영역 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
          <div style={{ textAlign: 'left', width: '100%', maxWidth: '300px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '15px' }}>
            {options.map((num) => (
              <label key={num} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', fontSize: '20px', cursor: 'pointer', borderBottom: num !== "5" ? '1px solid #eee' : 'none' }}>
                <input 
                  type="radio" 
                  name="quiz" 
                  value={num} 
                  checked={selectedAnswer === num}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  style={{ marginRight: '15px', width: '20px', height: '20px' }}
                />
                ({num}) 번
              </label>
            ))}
          </div>
        </div>

        {/* 결과 및 확인 버튼 */}
        <div style={{ minHeight: '120px' }}>
          {!message ? (
            <button 
              onClick={checkAnswer} 
              disabled={!selectedAnswer}
              style={{ padding: '15px 60px', fontSize: '18px', fontWeight: 'bold', backgroundColor: selectedAnswer ? '#333' : '#ccc', color: 'white', border: 'none', borderRadius: '30px', cursor: selectedAnswer ? 'pointer' : 'default' }}
            >
              정답 확인하기
            </button>
          ) : (
            <div style={{ padding: '20px', borderRadius: '15px', backgroundColor: message.includes('✅') ? '#ebfbee' : '#fff5f5' }}>
              <p style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>{message}</p>
              <button onClick={nextQuestion} style={{ padding: '12px 40px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                다음 문제
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- 저작권 출처 표시 (Footer) --- */}
      <footer style={{ marginTop: '80px', paddingTop: '20px', borderTop: '1px solid #eee', fontSize: '13px', color: '#888', lineHeight: '1.6' }}>
        <p>본 콘텐츠는 <strong>국사편찬위원회</strong>의 <strong>한국사능력검정시험 기출문제</strong>를 이용하였습니다.</p>
        <p>
          해당 저작물은 <a href="https://www.kogl.or.kr/info/license.do" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>공공누리 제1유형(출처표시)</a> 조건에 따라 이용할 수 있습니다.
        </p>
      </footer>
    </main>
  )
}