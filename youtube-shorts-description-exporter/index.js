const fs = require('fs');

class YouTubeShortsExtractor {
    constructor(apiKey) {
        this.apiKey = "AIzaSyCUUhg1cQEGZndb2iKJiYrurO7JAYWSjkQ";
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    }

    // 채널명으로 채널 ID를 찾습니다
    async getChannelId(channelName) {
        const url = `${this.baseUrl}/search`;
        const params = new URLSearchParams({
            key: this.apiKey,
            q: channelName,
            type: 'channel',
            part: 'id,snippet',
            maxResults: 1
        });

        try {
            const response = await fetch(`${url}?${params}`);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                return data.items[0].id.channelId;
            } else {
                console.log(`채널 '${channelName}'을 찾을 수 없습니다.`);
                return null;
            }
        } catch (error) {
            console.error('채널 검색 중 오류 발생:', error);
            return null;
        }
    }

    // 채널의 모든 비디오를 가져옵니다
    async getChannelVideos(channelId, maxResults = 100) {
        const videos = [];
        let nextPageToken = null;

        while (videos.length < maxResults) {
            const url = `${this.baseUrl}/search`;
            const params = new URLSearchParams({
                key: this.apiKey,
                channelId: channelId,
                part: 'id,snippet',
                type: 'video',
                order: 'date', // 최신순 정렬
                maxResults: Math.min(50, maxResults - videos.length) // API 최대 50개씩
            });

            if (nextPageToken) {
                params.append('pageToken', nextPageToken);
            }

            try {
                const response = await fetch(`${url}?${params}`);
                const data = await response.json();

                if (!data.items) break;

                videos.push(...data.items);
                nextPageToken = data.nextPageToken;

                if (!nextPageToken) break;

                // API 제한을 위한 잠시 대기
                await this.sleep(100);
            } catch (error) {
                console.error('비디오 목록 가져오기 중 오류 발생:', error);
                break;
            }
        }

        return videos.slice(0, maxResults);
    }

    // 비디오 ID 목록을 받아 쇼츠 여부를 확인합니다
    async checkIfShorts(videoIds) {
        const shortsInfo = {};

        // 한 번에 50개씩 처리 (API 제한)
        for (let i = 0; i < videoIds.length; i += 50) {
            const batchIds = videoIds.slice(i, i + 50);

            const url = `${this.baseUrl}/videos`;
            const params = new URLSearchParams({
                key: this.apiKey,
                id: batchIds.join(','),
                part: 'contentDetails,snippet'
            });

            try {
                const response = await fetch(`${url}?${params}`);
                const data = await response.json();

                if (data.items) {
                    for (const item of data.items) {
                        const videoId = item.id;
                        const duration = item.contentDetails.duration;

                        // 쇼츠는 보통 60초 이하
                        const isShort = this.isDurationShort(duration);

                        shortsInfo[videoId] = {
                            isShort: isShort,
                            duration: duration,
                            title: item.snippet.title,
                            publishedAt: item.snippet.publishedAt,
                            description: item.snippet.description.length > 100 
                                ? item.snippet.description.substring(0, 100) + '...'
                                : item.snippet.description
                        };
                    }
                }

                await this.sleep(100); // API 제한을 위한 대기
            } catch (error) {
                console.error('비디오 정보 가져오기 중 오류 발생:', error);
            }
        }

        return shortsInfo;
    }

    // YouTube duration 형식을 파싱하여 60초 이하인지 확인합니다
    isDurationShort(duration) {
        // PT1M30S -> 1분 30초, PT45S -> 45초
        let minutes = 0;
        let seconds = 0;

        const minuteMatch = duration.match(/(\d+)M/);
        if (minuteMatch) {
            minutes = parseInt(minuteMatch[1]);
        }

        const secondMatch = duration.match(/(\d+)S/);
        if (secondMatch) {
            seconds = parseInt(secondMatch[1]);
        }

        const totalSeconds = minutes * 60 + seconds;
        return totalSeconds <= 60;
    }

    // ===== 자막 추출 기능 =====

    // 비디오 페이지에서 자막 정보 추출
    async getTranscriptUrl(videoId) {
        try {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const response = await fetch(videoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const html = await response.text();

            // 자막 데이터 패턴 찾기
            const patterns = [
                /"captionTracks":\[(.*?)\]/,
                /"captions":\{"playerCaptionsTracklistRenderer":\{"captionTracks":\[(.*?)\]/
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    try {
                        const captionData = JSON.parse(`[${match[1]}]`);
                        
                        // 한국어 자막 우선 찾기
                        let selectedTrack = captionData.find(track => 
                            track.languageCode === 'ko' || 
                            track.languageCode === 'kr' ||
                            (track.name && track.name.simpleText && track.name.simpleText.includes('한국어'))
                        );

                        // 한국어가 없으면 자동 생성 자막 찾기
                        if (!selectedTrack) {
                            selectedTrack = captionData.find(track => track.kind === 'asr');
                        }

                        // 그것도 없으면 첫 번째 자막 사용
                        if (!selectedTrack && captionData.length > 0) {
                            selectedTrack = captionData[0];
                        }

                        if (selectedTrack && selectedTrack.baseUrl) {
                            return selectedTrack.baseUrl;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    // 자막 XML 데이터 파싱
    async fetchAndParseTranscript(baseUrl) {
        try {
            const response = await fetch(baseUrl);
            const xmlData = await response.text();

            // XML에서 텍스트 추출
            const textPattern = /<text[^>]*>(.*?)<\/text>/g;
            const texts = [];
            let match;

            while ((match = textPattern.exec(xmlData)) !== null) {
                // HTML 엔티티 디코딩 및 정리
                let text = match[1]
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, ' ')
                    .replace(/<[^>]*>/g, '') // HTML 태그 제거
                    .trim();

                if (text) {
                    texts.push(text);
                }
            }

            return texts.join(' ').replace(/\s+/g, ' ').trim();
        } catch (error) {
            return null;
        }
    }

    // 단일 비디오의 자막 추출
    async extractTranscript(videoData) {
        const { videoId, title } = videoData;
        
        try {
            console.log(`자막 추출 중: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`);

            const transcriptUrl = await this.getTranscriptUrl(videoId);
            
            if (!transcriptUrl) {
                console.log(`  ❌ 자막 없음`);
                return {
                    ...videoData,
                    transcript: null,
                    transcriptStatus: 'no_captions'
                };
            }

            const transcript = await this.fetchAndParseTranscript(transcriptUrl);
            
            if (transcript && transcript.length > 0) {
                console.log(`  ✅ 자막 추출 완료 (${transcript.length}자)`);
                return {
                    ...videoData,
                    transcript: transcript,
                    transcriptStatus: 'success'
                };
            } else {
                console.log(`  ❌ 자막 파싱 실패`);
                return {
                    ...videoData,
                    transcript: null,
                    transcriptStatus: 'parse_failed'
                };
            }

        } catch (error) {
            console.log(`  ❌ 오류: ${error.message}`);
            return {
                ...videoData,
                transcript: null,
                transcriptStatus: 'error'
            };
        }
    }

    // 여러 비디오의 자막 일괄 추출
    async extractMultipleTranscripts(shortsVideos, options = {}) {
        const results = [];
        const delay = options.delay || 1000; // 요청 간 지연시간

        console.log(`\n=== 자막 추출 시작 ===`);
        console.log(`총 ${shortsVideos.length}개 비디오의 자막을 추출합니다...\n`);

        for (let i = 0; i < shortsVideos.length; i++) {
            const video = shortsVideos[i];
            const result = await this.extractTranscript(video);
            results.push(result);

            // 진행률 표시
            if ((i + 1) % 10 === 0 || i === shortsVideos.length - 1) {
                console.log(`진행률: ${i + 1}/${shortsVideos.length} 완료`);
            }

            // 마지막 요청이 아니면 지연
            if (i < shortsVideos.length - 1) {
                await this.sleep(delay);
            }
        }

        // 통계 출력
        const successCount = results.filter(r => r.transcript).length;
        const noCapCount = results.filter(r => r.transcriptStatus === 'no_captions').length;
        const errorCount = results.length - successCount - noCapCount;

        console.log(`\n=== 자막 추출 완료 ===`);
        console.log(`성공: ${successCount}개`);
        console.log(`자막 없음: ${noCapCount}개`);
        console.log(`오류: ${errorCount}개`);

        return results;
    }

    // 채널명으로 쇼츠 영상들을 추출합니다
    async extractShorts(channelName, maxResults = 100) {
        console.log(`'${channelName}' 채널에서 쇼츠를 찾고 있습니다...`);

        // 1. 채널 ID 찾기
        const channelId = await this.getChannelId(channelName);
        if (!channelId) {
            return [];
        }

        console.log(`채널 ID: ${channelId}`);

        // 2. 채널의 모든 비디오 가져오기 (더 많이 가져와서 쇼츠만 필터링)
        const allVideos = await this.getChannelVideos(channelId, maxResults * 3);
        console.log(`총 ${allVideos.length}개의 비디오를 찾았습니다.`);

        // 3. 비디오 ID 추출
        const videoIds = allVideos.map(video => video.id.videoId);

        // 4. 쇼츠 여부 확인
        console.log('쇼츠 비디오를 필터링하고 있습니다...');
        const shortsInfo = await this.checkIfShorts(videoIds);

        // 5. 쇼츠만 필터링
        const shortsVideos = [];
        for (const video of allVideos) {
            const videoId = video.id.videoId;
            if (shortsInfo[videoId] && shortsInfo[videoId].isShort) {
                const videoData = {
                    videoId: videoId,
                    title: shortsInfo[videoId].title,
                    url: `https://www.youtube.com/shorts/${videoId}`,
                    publishedAt: shortsInfo[videoId].publishedAt,
                    duration: shortsInfo[videoId].duration,
                    description: shortsInfo[videoId].description
                };
                shortsVideos.push(videoData);
            }
        }

        // 6. 최신순으로 정렬하고 최대 개수만큼 반환
        shortsVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        return shortsVideos.slice(0, maxResults);
    }

    // 결과를 JSON 파일로 저장합니다
    saveToJson(shortsData, filename = 'youtube_shorts.json') {
        try {
            fs.writeFileSync(filename, JSON.stringify(shortsData, null, 2), 'utf-8');
            console.log(`결과가 ${filename}에 저장되었습니다.`);

            // 자막이 있는 비디오들만 따로 텍스트 파일로 저장
            const transcriptsData = shortsData.filter(video => video.transcript);
            if (transcriptsData.length > 0) {
                const textContent = transcriptsData.map(video => 
                    `=== ${video.title} ===\n${video.transcript}\n\n`
                ).join('');
                
                const textFilename = filename.replace('.json', '_transcripts.txt');
                fs.writeFileSync(textFilename, textContent, 'utf-8');
                console.log(`자막 텍스트가 ${textFilename}에 저장되었습니다.`);
            }
        } catch (error) {
            console.error('파일 저장 중 오류 발생:', error);
        }
    }

    // 지연 함수
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 사용자 입력을 받기 위한 함수
function getUserInput(question) {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        readline.question(question, (answer) => {
            readline.close();
            resolve(answer);
        });
    });
}

async function main() {
    // YouTube Data API 키를 입력하세요
    const API_KEY = 'AIzaSyCUUhg1cQEGZndb2iKJiYrurO7JAYWSjkQ';

    if (API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        console.log('YouTube Data API 키를 설정해주세요!');
        console.log('https://console.developers.google.com 에서 API 키를 발급받을 수 있습니다.');
        return;
    }

    const extractor = new YouTubeShortsExtractor(API_KEY);

    try {
        // 채널명 입력
        const channelName = await getUserInput('채널명을 입력하세요: ');
        if (!channelName.trim()) {
            console.log('올바른 채널명을 입력해주세요.');
            return;
        }

        // 자막 추출 여부 선택
        const extractTranscripts = await getUserInput('자막도 함께 추출하시겠습니까? (y/n): ');
        const shouldExtractTranscripts = extractTranscripts.toLowerCase().startsWith('y');

        // 쇼츠 추출
        const shorts = await extractor.extractShorts(channelName.trim(), 100);

        if (shorts.length > 0) {
            console.log(`\n총 ${shorts.length}개의 쇼츠를 찾았습니다!`);

            let finalResults = shorts;

            // 자막 추출
            if (shouldExtractTranscripts) {
                finalResults = await extractor.extractMultipleTranscripts(shorts, { delay: 1000 });
            }

            console.log('\n--- 최신 쇼츠 5개 미리보기 ---');
            finalResults.slice(0, 5).forEach((short, index) => {
                console.log(`\n${index + 1}. ${short.title}`);
                console.log(`   URL: ${short.url}`);
                console.log(`   업로드: ${short.publishedAt}`);
                console.log(`   길이: ${short.duration}`);
                if (short.transcript) {
                    console.log(`   자막: ${short.transcript.substring(0, 100)}${short.transcript.length > 100 ? '...' : ''}`);
                }
            });

            // JSON 파일로 저장
            const filename = `${channelName.replace(/\s+/g, '_')}_shorts.json`;
            extractor.saveToJson(finalResults, filename);

        } else {
            console.log('쇼츠를 찾을 수 없습니다.');
        }

    } catch (error) {
        console.error('오류 발생:', error.message);
    }
}

// Node.js 환경에서만 실행
if (typeof require !== 'undefined' && require.main === module) {
    main();
}

// 모듈로 사용할 수 있도록 export
if (typeof module !== 'undefined') {
    module.exports = YouTubeShortsExtractor;
}