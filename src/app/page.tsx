'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const BUCKET_NAME = (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET as string) || 'quiz-images';

interface Question {
  round: string;
  number: number;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string;
  answer: number;
}

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [availableIndices, setAvailableIndices] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState('') 
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  
  // 이미지 로딩 상태 관리 추가
  const [imageLoaded, setImageLoaded] = useState(false)

  const optionNumbers = ["1", "2", "3", "4", "5"];

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from('questions_v2')
      .select('*')
    
    if (error) {
      console.error('데이터 호출 에러:', error.message)
    } else if (data && data.length > 0) {
      setQuestions(data)
      const indices = Array.from({ length: data.length }, (_, i) => i)
      setAvailableIndices(indices)
      pickRandomQuestion(indices, data)
    }
    setLoading(false)
  }

  const pickRandomQuestion = (currentAvailable: number[], allQuestions: Question[]) => {
    setImageLoaded(false) // 새 문제를 뽑을 때 로딩 상태 초기화
    let targetAvailable = currentAvailable;
    if (targetAvailable.length === 0) {
      targetAvailable = Array.from({ length: allQuestions.length }, (_, i) => i)
    }
    const randomIndexInAvailable = Math.floor(Math.random() * targetAvailable.length)
    const selectedQuestionIndex = targetAvailable[randomIndexInAvailable]
    setCurrentIndex(selectedQuestionIndex)
    const nextAvailable = targetAvailable.filter((_, i) => i !== randomIndexInAvailable)
    setAvailableIndices(nextAvailable)
  }

  const getImageUrl = (round: string, fileName: string) => {
    if (!fileName || !fileName.endsWith('.png')) return null;
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${round}/${fileName}`);
    return data.publicUrl;
  }

  const checkAnswer = () => {
    if (currentIndex === null) return
    const currentQuestion = questions[currentIndex]
    const isCorrect = selectedAnswer === currentQuestion.answer.toString()
    if (isCorrect) {
      setMessage('✅ 정답입니다!')
    } else {
      setMessage(`❌ 틀렸습니다. (정답: ${currentQuestion.answer}번)`)
    }
  }

  const nextQuestion = () => {
    setSelectedAnswer('')
    setMessage('')
    pickRandomQuestion(availableIndices, questions)
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>데이터를 불러오는 중...</div>
  if (questions.length === 0 || currentIndex === null) return <div style={{ padding: '40px', textAlign: 'center' }}>등록된 문제가 없습니다.</div>

  const currentQuiz = questions[currentIndex]

  // 레이아웃 판별
  const optionsData = optionNumbers.map(num => ({
    num,
    value: currentQuiz[`option_${num}` as keyof Question] as string,
    isImage: (currentQuiz[`option_${num}` as keyof Question] as string)?.endsWith('.png')
  }));

  const hasImageOption = optionsData.some(opt => opt.isImage);
  const isShortTextOption = !hasImageOption && optionsData.every(opt => opt.value.length <= 6);

  let optionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: '#f9f9f9',
    padding: '15px 25px',
    borderRadius: '15px',
    width: 'fit-content',
    margin: '0 auto',
    textAlign: 'left',
    // 이미지 로딩 전에는 투명도를 낮추고 클릭을 막음
    opacity: imageLoaded ? 1 : 0.3,
    pointerEvents: imageLoaded ? 'auto' : 'none',
    transition: 'opacity 0.2s ease-in-out'
  };

  if (hasImageOption) {
    optionsContainerStyle = { ...optionsContainerStyle, display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '15px' };
  } else if (isShortTextOption) {
    optionsContainerStyle = { ...optionsContainerStyle, flexDirection: 'row', gap: '25px' };
  }

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px 40px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <h1 style={{ marginBottom: '5px', fontSize: '22px' }}>한국사 랜덤 기출문제</h1>
        <p style={{ color: '#666', marginBottom: '15px', fontSize: '15px' }}>
          {currentQuiz.round}회 {currentQuiz.number}번 문제
        </p>

        {/* 문제 이미지 영역 */}
        <div style={{ width: '100%', marginBottom: '20px', display: 'flex', justifyContent: 'center', minHeight: '200px', alignItems: 'center', backgroundColor: imageLoaded ? 'transparent' : '#f0f0f0', borderRadius: '8px' }}>
          {!imageLoaded && <p style={{ color: '#aaa' }}>이미지 로딩 중...</p>}
          <img 
            src={getImageUrl(currentQuiz.round, `q${currentQuiz.number}.png`) || ''} 
            alt="문제" 
            onLoad={() => setImageLoaded(true)} // 로딩 완료 시 상태 변경
            style={{ 
              width: '100%', 
              maxWidth: '480px', 
              height: 'auto', 
              display: imageLoaded ? 'block' : 'none' 
            }} 
          />
        </div>

        {/* 보기 영역: imageLoaded 상태에 따라 비활성화됨 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
          <div style={optionsContainerStyle}>
            {optionsData.map((opt, idx) => {
              const optionImageUrl = getImageUrl(currentQuiz.round, opt.value);
              const gridStyle: React.CSSProperties = hasImageOption && idx >= 3 ? { gridColumn: idx === 3 ? '1 / 2' : '2 / 3' } : {};

              return (
                <label key={opt.num} style={{ 
                  display: 'flex', alignItems: 'center', padding: '8px 0', fontSize: '17px', cursor: imageLoaded ? 'pointer' : 'default',
                  borderBottom: !hasImageOption && !isShortTextOption && opt.num !== "5" ? '1px solid #eee' : 'none',
                  whiteSpace: 'nowrap', width: 'max-content', ...gridStyle
                }}>
                  <input 
                    type="radio" name="quiz" value={opt.num} 
                    checked={selectedAnswer === opt.num}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    disabled={!imageLoaded} // 이미지 로딩 전에는 입력 불가
                    style={{ marginRight: '10px', width: '18px', height: '18px', flexShrink: 0 }}
                  />
                  <span style={{ marginRight: '8px', fontWeight: 'bold' }}>({opt.num})</span>
                  {optionImageUrl ? (
                    <img src={optionImageUrl} alt="" style={{ width: 'auto', height: 'auto', maxWidth: '280px', borderRadius: '4px', border: '1px solid #ddd' }} />
                  ) : (
                    <span>{opt.value}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* 결과 제출 및 다음 문제 버튼 영역 */}
        <div style={{ minHeight: '80px' }}>
          {!message ? (
            <button 
              onClick={checkAnswer} 
              disabled={!selectedAnswer || !imageLoaded}
              style={{ padding: '12px 50px', fontSize: '17px', fontWeight: 'bold', backgroundColor: (selectedAnswer && imageLoaded) ? '#333' : '#ccc', color: 'white', border: 'none', borderRadius: '30px', cursor: (selectedAnswer && imageLoaded) ? 'pointer' : 'default' }}
            >
              정답 확인하기
            </button>
          ) : (
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '20px', 
              padding: '12px 25px', 
              borderRadius: '15px', 
              backgroundColor: message.includes('✅') ? '#ebfbee' : '#fff5f5' 
            }}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{message}</p>
              <button 
                onClick={nextQuestion} 
                style={{ padding: '8px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
              >
                다음 문제 →
              </button>
            </div>
          )}
        </div>
      </div>

      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee', fontSize: '13px', color: '#888', lineHeight: '1.6' }}>
        <p>본 콘텐츠는 <strong>국사편찬위원회</strong>의 <strong>한국사능력검정시험 기출문제</strong>를 이용하였습니다.</p>
        <p>
          해당 저작물은 <a href="https://www.kogl.or.kr/info/license.do" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>공공누리 제1유형(출처표시)</a> 조건에 따라 이용할 수 있습니다.
        </p>
      </footer>
    </main>
  )
}