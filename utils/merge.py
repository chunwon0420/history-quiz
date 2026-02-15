import pandas as pd
import os
import glob

def merge_quiz_csv():
    base_path = "./output"
    all_files = glob.glob(os.path.join(base_path, "**", "*.csv"), recursive=True)
    
    if not all_files:
        print("합칠 CSV 파일이 output 폴더 내에 없습니다.")
        return

    df_list = []
    print(f"총 {len(all_files)}개의 파일을 병합 시도 중...")

    for file_path in all_files:
        if "quiz_total.csv" in file_path:
            continue
            
        try:
            temp_df = pd.read_csv(file_path)
            # 회차와 번호는 정밀한 병합을 위해 타입을 맞춤
            temp_df['round'] = temp_df['round'].astype(str)
            temp_df['number'] = temp_df['number'].astype(int)
            df_list.append(temp_df)
        except Exception as e:
            print(f"파일 읽기 실패 ({file_path}): {e}")

    if not df_list:
        return

    # 1. 데이터 병합
    combined_df = pd.concat(df_list, ignore_index=True)

    # 2. 그룹화하여 중복 데이터 합치기
    total_df = combined_df.groupby(['round', 'number'], as_index=False).first()

    # 3. [핵심 수정] 정수형 변환 로직
    # answer 열이 존재한다면 빈 값을 0(또는 적절한 값)으로 채우고 정수 변환
    if 'answer' in total_df.columns:
        total_df['answer'] = total_df['answer'].fillna(0).astype(int)

    # 4. 컬럼 순서 고정 및 미존재 컬럼 생성
    cols = ['round', 'number', 'option_1', 'option_2', 'option_3', 'option_4', 'option_5', 'answer']
    for col in cols:
        if col not in total_df.columns:
            total_df[col] = ""
            
    # 정렬 및 저장
    total_df = total_df[cols].sort_values(by=['round', 'number'])
    output_path = os.path.join(base_path, "quiz_total.csv")
    total_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    print("-" * 30)
    print(f"🎉 통합 완료! 'answer' 열이 정수형으로 저장되었습니다.")
    print(f"결과 파일: {output_path}")

if __name__ == "__main__":
    merge_quiz_csv()