export const messages = {
  app: {
    title: '여행 도착/출발 플래너',
  },
  health: {
    checking: '서버 상태 확인 중...',
    up: '서버 연결됨 (UP)',
    down: '서버에 연결할 수 없습니다',
  },
  home: {
    newTrip: '새 여행 만들기',
  },
  tripList: {
    title: '내 여행',
    empty: '아직 만든 여행이 없습니다.',
    error: '여행 목록을 불러오지 못했습니다.',
  },
  tripCreate: {
    title: '새 여행 만들기',
    outbound: '가는 편',
    return: '오는 편',
    flightNo: '편명',
    flightNoPlaceholder: '예: KE723',
    city: '여행 도시',
    cityPlaceholder: '도시를 선택하세요',
    citiesError: '도시 목록을 불러오지 못했습니다.',
    area: '숙소 지역',
    areaPlaceholder: '지역을 선택하세요',
    areaNeedsCity: '도시를 먼저 선택하세요',
    areasError: '지역 목록을 불러오지 못했습니다.',
    startDate: '시작일 (가는 편 출발일)',
    endDate: '종료일 (오는 편 출발일)',
    submit: '여행 생성하기',
    submitting: '생성 중...',
    validation: {
      flightNo: '편명 형식이 올바르지 않습니다. 예: KE723',
      city: '여행 도시를 선택하세요.',
      area: '숙소 지역을 선택하세요.',
      startDate: '시작일을 선택하세요.',
      endDate: '종료일을 선택하세요.',
      endBeforeStart: '종료일은 시작일보다 빠를 수 없습니다.',
      tooLong: '여행 기간은 최대 30일입니다.',
      airport: '공항을 선택하세요.',
      manualAt: '시각을 입력하세요.',
      returnBeforeOutbound:
        '오는 편 출발 시각은 가는 편 도착 시각보다 늦어야 합니다.',
    },
    preview: {
      loading: '항공편 조회 중...',
      notFound: '항공편을 찾지 못했습니다.',
      unavailable: '항공편 정보를 일시적으로 조회할 수 없습니다.',
      error: '항공편 조회 중 문제가 발생했습니다.',
      matchedLeg: '여행 도시 구간',
      canceled: '결항',
      canceledUncertain: '결항 가능성',
      delayed: '지연',
      scheduled: '예정',
      outboundMismatch: (city: string) =>
        `이 항공편은 선택한 여행 도시(${city})의 공항에 도착하지 않습니다.`,
      returnMismatch: (city: string) =>
        `이 항공편은 선택한 여행 도시(${city})의 공항에서 출발하지 않습니다.`,
    },
    manual: {
      enter: '직접 입력',
      back: '편명 조회로 돌아가기',
      hint: '항공편 시각을 여행 도시 현지 시각으로 입력하세요.',
      airportPlaceholder: '공항을 선택하세요',
      outboundAirport: '도착 공항',
      outboundAt: '도착 시각 (현지)',
      returnAirport: '출발 공항',
      returnAt: '출발 시각 (현지)',
    },
    errors: {
      INVALID_FLIGHT_NO: '편명 형식이 올바르지 않습니다.',
      VALIDATION_FAILED: '입력값을 다시 확인해 주세요.',
      INVALID_DATE_RANGE:
        '여행 기간이 올바르지 않습니다. 종료일과 직접 입력한 시각이 여행 기간 안에 있는지 확인하세요.',
      CITY_AIRPORT_MISMATCH: '선택한 여행 도시와 항공편 공항이 다릅니다.',
      CITY_NOT_FOUND: '지원하지 않는 도시입니다.',
      FLIGHT_NOT_FOUND:
        '항공편을 찾지 못했습니다. "직접 입력"으로 도착/출발 시각을 입력해 주세요.',
      FLIGHT_PROVIDER_UNAVAILABLE:
        '항공편 정보를 일시적으로 조회할 수 없습니다. "직접 입력"으로 도착/출발 시각을 입력해 주세요.',
      RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    } as Record<string, string>,
  },
  tripDetail: {
    title: '여행 상세',
    outbound: '가는 편 도착',
    return: '오는 편 출발',
    source: {
      AERODATABOX: '항공편 조회',
      MANUAL: '직접 입력',
    },
    status: {
      Expected: '예정',
      Delayed: '지연',
      Canceled: '결항',
      CanceledUncertain: '결항 가능성',
      Manual: '직접 입력',
    } as Record<string, string>,
    noToken:
      '이 기기에서 만든 여행만 볼 수 있습니다. 여행 정보(소유 토큰)가 없습니다.',
    forbidden: '이 여행을 볼 권한이 없습니다.',
    notFound: '여행을 찾을 수 없습니다.',
    delete: '여행 삭제',
    deleteConfirm: '이 여행을 삭제할까요? 되돌릴 수 없습니다.',
    deleteYes: '삭제',
    deleteNo: '취소',
    deleting: '삭제 중...',
    deleteError: '여행을 삭제하지 못했습니다.',
    home: '홈으로',
    tabs: {
      label: '여행 상세 탭',
      arrival: '도착일',
      itinerary: '일정',
      departure: '귀국일',
    },
    comingSoon: '준비 중입니다.',
  },
  transfer: {
    immigration: '입국 소요 시간',
    immigrationHint: '입국 심사·수하물 수령에 걸리는 시간',
    immigrationOption: (min: number) => `${min}분`,
    timeline: '도착 타임라인',
    landing: '착륙',
    ready: '입국 완료',
    recommendedDepart: (name: string) => `추천편 출발 · ${name}`,
    arriveArea: '숙소 도착',
    noRecommendation: '입국 후 조회 시간 안에 탈 수 있는 대중교통이 없습니다.',
    noTransitWarning:
      '도착 후 2시간 안에 운행하는 대중교통이 없습니다. 택시·차량 호출을 이용하세요.',
    serviceEnded: '운행 종료',
    firstDeparture: '첫차',
    noDepartures: '조회 시간 안에 출발편이 없습니다.',
    duration: (min: number) => `소요 ${min}분`,
    walk: (min: number) => `도보 ${min}분`,
    allDay: '24시간',
    boardingTip: '승차 위치',
    departures: '출발 시각',
    departAt: '출발',
    arriveAt: '도착',
    recommended: '추천',
    hardToCatch: '탑승 어려움',
    dataAsOf: (date: string) => `시간표 기준일 ${date}`,
    /** +1 같은 날짜 배지의 스크린리더 문구 */
    dayOffset: (days: number) =>
      days === 1 ? '다음 날' : days > 0 ? `${days}일 후` : `${-days}일 전`,
    mode: {
      RAIL: '철도',
      SUBWAY: '지하철',
      BUS: '공항버스',
      TAXI: '택시',
      RIDE_HAILING: '차량 호출',
    },
  },
  departure: {
    airportBuffer: '공항 도착 여유 시간',
    airportBufferHint: '항공편 출발 시각보다 얼마나 먼저 공항에 도착할지',
    airportBufferOption: (min: number) =>
      min % 60 === 0
        ? `${min / 60}시간`
        : `${Math.floor(min / 60)}시간 ${min % 60}분`,
    summary: '귀국일 타임라인',
    headlinePrefix: '늦어도',
    headlineSuffix: '에 숙소에서 출발하세요',
    /** 자정 직후 항공편은 숙소 출발이 항공편 전날이다 */
    otherDay: (date: string) =>
      `${date} 출발이에요. 항공편 출발일과 날짜가 달라요.`,
    leaveArea: (name: string) => `숙소 출발 · ${name}`,
    deadline: '공항 도착 마감',
    flightDeparture: '항공편 출발',
    leaveAt: '숙소 출발',
    boardAt: '탑승',
    arriveAirportAt: '공항 도착',
    latest: '가장 늦은 출발',
    safer: '여유 있게',
    lastTrain: '막차',
    leaveByPrefix: '늦어도',
    leaveBySuffix: '출발',
    canceled:
      '결항 또는 결항 가능성이 있는 항공편으로 표시되어 있어요. 아래 시각은 참고용이니 항공사에 확인해 주세요.',
    delayedAt: '항공편이 지연으로 표시되어 있어요. 변경된 출발 시각',
    delayedDetail:
      '지연은 줄어들 수 있어서 아래 시각은 원래 출발 시각을 기준으로 안내해요. 항공사에 확인해 주세요.',
    flightDepartureOriginal: '항공편 원래 출발',
    boardingMargin: (min: number) =>
      `표 구매와 승강장 이동에 필요한 ${min}분을 포함한 시각이에요.`,
    leaveByEstimate:
      '소요 시간은 추정치이고 교통 상황에 따라 더 걸릴 수 있어요.',
    notice:
      '항공편 시각은 여행을 만들 때 저장한 값이에요. 연말연시 같은 특별 시간표 기간에는 실제 운행 시각이 다를 수 있어요. 출발 전에 항공사와 운영사에 다시 확인하세요.',
    firstTrainTooLate: '첫차로는 시간을 맞출 수 없어요',
    noTimeAfterLanding: '착륙 후 공항을 나갈 시간이 없어요',
    noTimeAfterLandingDetail:
      '이 일정으로는 숙소에 들렀다 돌아올 수 없어요. 가는 편과 오는 편 시각을 확인해 주세요.',
    outsideWindow:
      '마감 시각에 맞출 수 있는 막차예요. 공항에 일찍 도착해 오래 기다려야 해요.',
    takeOnDemand: '택시·차량 호출을 이용하세요.',
    considerOnDemand: '오래 기다리기 어렵다면 택시·차량 호출도 확인하세요.',
    noOptions:
      '이용할 수 있는 교통편이 없어요. 숙소나 항공사에 공항 가는 방법을 확인해 주세요.',
  },
  notFound: {
    title: '페이지를 찾을 수 없습니다',
    home: '홈으로',
  },
  common: {
    retry: '다시 시도',
    error: '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    loading: '불러오는 중...',
  },
} as const
