import pdfplumber
import fitz
import pandas as pd
import re
import os
import shutil
import sys
import traceback
from PIL import Image, ImageChops

def trim_image(img_path):
    try:
        img = Image.open(img_path).convert("RGB")
        bg = Image.new(img.mode, img.size, (255, 255, 255))
        diff = ImageChops.difference(img, bg)
        bbox = diff.getbbox()
        if bbox:
            left, top, right, bottom = bbox
            img.crop((max(0, left-5), max(0, top-5), min(img.size[0], right+5), min(img.size[1], bottom+5))).save(img_path)
    except Exception: pass

def clean_text_format(text):
    if not text: return ""
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'^["\'“”‘’]+|["\'“”‘’]+$', '', text).strip()
    return text

def parse_answer_pdf(pdf, exam_round, output_dir):
    """정답 PDF 분석: round, number, answer 컬럼만 추출"""
    print(f">> [{exam_round}회] 정답표 파싱을 시작합니다.")
    ans_data = []
    symbol_to_num = {'①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5} #

    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                for i in range(0, len(row), 3):
                    try:
                        q_num_raw = str(row[i]).strip()
                        ans_raw = str(row[i+1]).strip()
                        q_nums = re.findall(r'\d+', q_num_raw)
                        ans_list = re.findall(r'[1-5①-⑤]', ans_raw)
                        for q, a in zip(q_nums, ans_list):
                            final_ans = symbol_to_num[a] if a in symbol_to_num else int(a)
                            ans_data.append({
                                'round': exam_round,
                                'number': int(q),
                                'answer': final_ans
                            })
                    except (IndexError, ValueError):
                        continue
    if ans_data:
        df = pd.DataFrame(ans_data).drop_duplicates('number').sort_values('number')
        out_path = os.path.join(output_dir, f"quiz_answer_{exam_round}.csv")
        df.to_csv(out_path, index=False, encoding='utf-8-sig')
        print(f"✅ 정답 CSV 생성 완료: {out_path}")

def process_pdf(pdf_path):
    file_name = os.path.basename(pdf_path)
    
    with pdfplumber.open(pdf_path) as pdf:
        first_page_text = pdf.pages[0].extract_text() or ""
        round_match = re.search(r'제(\d+)회', first_page_text)
        exam_round = round_match.group(1) if round_match else "unknown"
        
        is_answer_pdf = "정답표" in first_page_text or "정답" in file_name
        
        output_base = "./output"
        round_dir = os.path.join(output_base, exam_round)
        if not os.path.exists(round_dir): os.makedirs(round_dir)

        if is_answer_pdf:
            parse_answer_pdf(pdf, exam_round, round_dir)
        else:
            print(f"\n--- [{file_name}] 문제지 추출 시작 ---")
            img_dir = os.path.join(round_dir, "images")
            os.makedirs(img_dir, exist_ok=True)
            doc = fitz.open(pdf_path)
            option_symbols = ['①', '②', '③', '④', '⑤']
            results = []

            for page_idx, page in enumerate(pdf.pages):
                width, height = page.width, page.height
                safe_height = height * 0.95 
                columns = [(0, 0, width/2, safe_height), (width/2, 0, width, safe_height)]
                
                for area in columns:
                    crop = page.within_bbox(area)
                    words = crop.extract_words(x_tolerance=3, y_tolerance=3)
                    
                    # [로직 수정] 문제 번호 판단 기준 완화 및 정교화
                    q_indices = []
                    for i, w in enumerate(words):
                        # 1. '숫자.' 형식인지 확인
                        if re.match(r'^\d+\.', w['text']):
                            # 2. x좌표 오차 범위를 50pt로 확장 (77회 누락 방지)
                            # 3. 추가 조건: 단어의 너비나 높이가 지문 내 숫자보다 보통 큼 (옵션)
                            if (w['x0'] - area[0]) < 50: 
                                q_indices.append(i)
                    
                    for idx, word_idx in enumerate(q_indices):
                        word = words[word_idx]
                        q_num = word['text'].replace('.', '')
                        q_top = word['top']
                        
                        # 다음 문제 번호의 위치를 찾아 현재 문제의 하단 경계로 설정
                        next_q_top = words[q_indices[idx+1]]['top'] if idx+1 < len(q_indices) else safe_height
                        
                        # 현재 문제 범위 내의 선지 기호 찾기
                        all_possible_opts = [w for w in words if w['text'] in option_symbols and q_top < w['top'] < next_q_top]
                        
                        if len(all_possible_opts) >= 5:
                            # 가장 하단의 5개를 선지로 확정
                            current_q_opts = sorted(all_possible_opts, key=lambda x: (x['top'], x['x0']))[-5:]
                            opt1_top = current_q_opts[0]['top']
                            zoom = 2; mat = fitz.Matrix(zoom, zoom)
                            
                            # 문제 이미지 저장 영역 (문제 번호 위쪽부터 첫 번째 선지 직전까지)
                            q_img_path = os.path.join(img_dir, f"q{q_num}.png")
                            q_rect = fitz.Rect(area[0], q_top - 10, area[2], opt1_top - 5)
                            if q_rect.height > 10:
                                doc[page_idx].get_pixmap(matrix=mat, clip=q_rect).save(q_img_path)
                                trim_image(q_img_path)

                            opt_data = {}
                            for j in range(5):
                                symbol = option_symbols[j]
                                curr_opt = current_q_opts[j]
                                # 같은 줄에 다음 선지가 있는지 확인
                                same_line_next = [o for o in current_q_opts if abs(o['top'] - curr_opt['top']) < 10 and o['x0'] > curr_opt['x0']]
                                right_limit = same_line_next[0]['x0'] if same_line_next else area[2]
                                # 다음 줄에 선지가 있는지 확인
                                next_line_opts = [o for o in current_q_opts if o['top'] > curr_opt['top'] + 10]
                                bottom_limit = next_line_opts[0]['top'] if next_line_opts else next_q_top
                                
                                opt_box = (curr_opt['x0'], curr_opt['top'] - 2, right_limit, bottom_limit - 2)
                                try:
                                    raw_text = page.within_bbox(opt_box).extract_text() or ""
                                    clean_text = clean_text_format(raw_text.replace(symbol, ""))
                                    if len(clean_text) < 2:
                                        opt_img_name = f"q{q_num}a{j+1}.png"
                                        opt_clip = fitz.Rect(curr_opt['x0'] + 15, curr_opt['top'] - 2, right_limit - 5, bottom_limit - 5)
                                        doc[page_idx].get_pixmap(matrix=mat, clip=opt_clip).save(os.path.join(img_dir, opt_img_name))
                                        trim_image(os.path.join(img_dir, opt_img_name))
                                        opt_data[f'option_{j+1}'] = opt_img_name
                                    else:
                                        opt_data[f'option_{j+1}'] = clean_text
                                except: opt_data[f'option_{j+1}'] = "error"
                            results.append({'round': exam_round, 'number': q_num, **opt_data})

            df = pd.DataFrame(results)
            out_path = os.path.join(round_dir, f"quiz_question_{exam_round}.csv")
            df.to_csv(out_path, index=False, encoding='utf-8-sig')
            print(f"✅ 문제 CSV 생성 완료: {out_path}")

if __name__ == "__main__":
    if not os.path.exists("./output"): os.makedirs("./output")
    try:
        if len(sys.argv) > 1:
            for path in sys.argv[1:]: process_pdf(path)
    except: traceback.print_exc()
    finally: input("\n엔터를 누르면 종료됩니다...")