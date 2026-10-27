import { KORA } from '../calculators.mjs';
const source=(label,url)=>({label,url});
const AHA=source('American Heart Association — All About Heart Rate','https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse');
const TARGET=source('American Heart Association — Target Heart Rates','https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/target-heart-rates');
const MAYO=source('Mayo Clinic — Heart rate: what is normal?','https://www.mayoclinic.org/healthy-lifestyle/fitness/expert-answers/heart-rate/faq-20057979');
const VOSS=source('Voss et al. (2015), KORA S4, tables 5 and 7 — PLOS ONE','https://doi.org/10.1371/journal.pone.0118308');
const HRVKIT=source('Apple HealthKit — heartRateVariabilitySDNN','https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn');
const HC=source('Google — Health Connect supported data types','https://developer.android.com/health-and-fitness/guides/health-connect/data-and-data-types/data-types');
const TANAKA=source('Tanaka, Monahan & Seals (2001) — Age-predicted maximal heart rate revisited','https://pubmed.ncbi.nlm.nih.gov/11153730/');
const SHAFFER=source('Shaffer & Ginsberg (2017) — An Overview of Heart Rate Variability Metrics and Norms','https://doi.org/10.3389/fpubh.2017.00258');
const APPLE=source('Apple Support — Manage Health data on iPhone, iPad or Apple Watch','https://support.apple.com/en-us/108779');
const GOOGLE=source('Google — Get started with Health Connect','https://support.google.com/android/answer/12201227');
const q=(q,a)=>({q,a});const s=(heading,...paragraphs)=>({heading,paragraphs});
function page(id,slug,calculator,ru,en,sources){return {id,slug,kind:calculator?'tool':'hub',calculator,updated:'2026-10-27',ru,en,sources};}
const numbers=[48,56,57,65,80,115];
export const corePages=[
page('resting-pulse','resting-heart-rate','pulse',{
 title:'Норма пульса в покое по возрасту — калькулятор 2026',description:"Проверь пульс в покое: ориентир 60–100 уд/мин для взрослых. Бесплатный калькулятор и разбор значений 48, 56, 57, 65, 80 и 115.",h1:'Пульс в покое',
 lead:'Обычно 60–100 ударов в минуту у взрослых. Проверь своё значение — с учётом условий измерения и личной базы.',
 sections:[
 {...s('Есть ли отдельная норма пульса для женщин и мужчин?', "Клинический ориентир 60–100 уд/мин относится к взрослым женщинам и мужчинам. Возраст, тренированность, лекарства и условия измерения помогают понять контекст конкретного значения.", 'У хорошо тренированных людей пульс может быть ниже 60. Это объяснение возможного контекста, а не автоматическое заключение, что любое низкое значение безопасно. Для детей, беременности, болезней сердца и приёма влияющих на пульс препаратов нужна индивидуальная оценка.'),table:{headers:['Возраст','Женщины','Мужчины'],rows:['18–29','30–39','40–49','50–59','60+'].map(a=>[a,'60–100 уд/мин','60–100 уд/мин'])}},
 {...s('Как правильно измерять пульс в покое?','Число во время движения, стресса или сразу после кофе — не то же самое, что измерение в спокойном состоянии. Сравнивай похожие условия; утренний пульс и дневной пульс после дороги на работу отвечают на разные вопросы.'),steps:['Отдохни сидя или лёжа и дождись спокойного дыхания.','Найди пульс на запястье указательным и средним пальцами, не большим.','Считай удары 60 секунд. Сверь с часами, если используешь их.','Повтори в сопоставимых условиях в другой день и смотри на устойчивую тенденцию.']},
 ...numbers.map(n=>s(`Пульс ${n} в покое — это нормально?`,n<60?`${n} уд/мин ниже общего взрослого диапазона. Такое бывает у тренированных людей, во сне и на фоне некоторых лекарств. Если раньше пульс был выше, значение устойчиво или есть слабость и головокружение, обсуди его с врачом. По одному числу нельзя установить причину.`:n>100?`${n} уд/мин в спокойном состоянии выше общего взрослого диапазона. Перемерь после отдыха, обрати внимание на температуру, стресс, лекарства и недавнюю нагрузку. Если повышение сохраняется, нужна консультация; при выраженных симптомах не жди повторного измерения.`:`${n} уд/мин входит в общий диапазон 60–100 для взрослых, но не доказывает, что со здоровьем всё в порядке. Сравни с обычным для тебя пульсом и учти симптомы. Устойчивый сдвиг от личной базы может быть важнее попадания в широкую таблицу.`)),
 s('Что показывает Фита помимо одного числа?',"Разреши Фите чтение пульса покоя в Apple Health на iPhone или Health Connect на Android. В гайде своего устройства найдёшь настройку категорий и источников.","В приложении можно посмотреть тенденцию и обсудить её вместе со сном, HRV и нагрузкой. Через MCP Фиты разрешённые метрики доступны подключённому ИИ-ассистенту. Это помогает задавать вопросы о своих данных, но не заменяет обследование.")],
 faq:[q('Пульс 80 — это много?','80 уд/мин входит в обычный взрослый диапазон в покое. Важны твоя личная база, условия измерения и самочувствие.'),q('Пульс 48 у спортсмена всегда безопасен?','Не всегда. Тренированность — одна из возможных причин; симптомы, устойчивое изменение и медицинский контекст требуют отдельной оценки.'),q('Какой пульс должен быть ночью?','Во сне он часто ниже дневного, но единой персональной ночной нормы по возрасту нет. Сравнивай собственные ночи при одинаковом способе измерения.'),q('Нужно ли снижать пульс по результату калькулятора?','Нет. Калькулятор не назначает лечение и не советует менять лекарства. Стойкие изменения и симптомы обсуди с врачом.'),q('Передаются ли введённые данные в Фиту?','Нет. Этот калькулятор считает в браузере, не сохраняет и не отправляет введённые значения.')]
},{
 title:'Resting Heart Rate by Age: Adult Range & Checker — FITA',description:"Check resting heart rate against the general 60–100 bpm adult range. Free calculator and practical context for common pulse readings.",h1:'Resting heart rate',lead:'Usually 60–100 beats per minute for adults. Check a reading in the context of your usual baseline.',
 sections:[{...s('Does the adult range change with age or sex?',"The general 60–100 bpm reference applies to adult women and men. Age, fitness, medicines and measurement conditions provide context for your own reading.",'Trained people can have a resting rate below 60. That possible explanation does not prove that any low reading is safe. Children, pregnancy, heart conditions and medicines require individual context.'),table:{headers:['Age','Women','Men'],rows:['18–29','30–39','40–49','50–59','60+'].map(a=>[a,'60–100 bpm','60–100 bpm'])}},
 {...s('How should I measure a resting pulse?','Movement, stress and recent caffeine change the context. Compare measurements under similar conditions instead of treating every watch sample as a resting value.'),steps:['Rest sitting or lying down until your breathing is calm.','Find the pulse at your wrist with two fingers, not your thumb.','Count beats for a full minute and compare with your watch if available.','Repeat under similar conditions on another day; review the trend.']},
 ...numbers.map(n=>s(`Is a resting heart rate of ${n} bpm normal?`,n<60?`${n} bpm is below the general adult range. Training, sleep and some medicines may explain it. New or persistent low readings, weakness or dizziness need individual medical advice, not a calculator diagnosis.`:n>100?`${n} bpm at rest is above the general adult range. Check again after rest and consider recent activity, temperature, stress and medicines. Persistent elevation warrants medical advice; severe symptoms need prompt care.`:`${n} bpm is within the general adult reference range, but that does not prove good health. Your usual baseline and symptoms still matter.`)),
 s('How can FITA help with a personal trend?',"Allow FITA to read resting heart rate in Apple Health on iPhone or Health Connect on Android. Find category and source setup in your device guide.",'Discuss the available trend alongside sleep, HRV and workouts. With FITA MCP you can grant an AI assistant access to supported metrics; neither a wearable nor an assistant replaces medical care.')],
 faq:[q('Is 80 bpm too high?','It is within the usual adult resting range, but personal baseline and symptoms still matter.'),q('Is 48 bpm always safe for athletes?','No. Training is one possible explanation; symptoms and changes from baseline need individual assessment.'),q('Should my sleeping pulse match my daytime resting rate?','Not necessarily. Sleep often lowers pulse; compare like-for-like conditions and your own trend.'),q('Should I change medication based on this checker?','No. It provides general context, not treatment or medication advice.'),q('Are calculator inputs uploaded?','No. The calculation runs in your browser without saving or sending inputs.')]
},[AHA,MAYO,TARGET]),
page('hrv','hrv-by-age','hrv',{
 title:'Вариабельность пульса HRV — нормы по возрасту и полу 2026',description:"Сравни HRV с исследованием KORA: SDNN и RMSSD по возрасту и полу. Пойми свою метрику и отслеживай личную динамику с Фитой.",h1:'Вариабельность пульса',lead:'Выбери SDNN или RMSSD, сравни с исследованием по возрасту и следи за своей динамикой.',
 sections:[{...s('Какие значения получили исследователи по возрастам?','В KORA S4 исследовали 1906 взрослых 25–74 лет по короткой записи ЭКГ в покое. Ниже средние значения SDNN и RMSSD; разброс внутри каждой группы велик. Это исследовательские ориентиры, не диагноз и не валидированная шкала для Apple Watch или ночного измерения кольцом.','Калькулятор показывает среднее и интервал среднее ± одно стандартное отклонение из таблиц 5 и 7. Не называем этот интервал «нормой» и не вычисляем риск болезни. Для возраста вне 25–74 лет не переносим крайние группы.'),table:{headers:['Возраст','SDNN женщины, мс','SDNN мужчины, мс','RMSSD женщины, мс','RMSSD мужчины, мс'],rows:KORA.map(b=>[`${b.from}–${b.to}`,b.f.sdnn.join(' ± '),b.m.sdnn.join(' ± '),b.f.rmssd.join(' ± '),b.m.rmssd.join(' ± ')])}},
 {...s('Почему SDNN и RMSSD нельзя смешивать?','SDNN описывает разброс нормальных интервалов между ударами, RMSSD — последовательные различия. Одинаковые единицы не делают их взаимозаменяемыми. Пересчёт по постоянному коэффициенту не исправляет разницу протоколов.'),table:{headers:['Запись','Что учитывать'],rows:[['HRV в Apple Health','Тип HealthKit heartRateVariabilitySDNN хранит SDNN. Смотри источник и время записи.'],['Health Connect','Тип HeartRateVariabilityRmssdRecord хранит RMSSD; наличие зависит от записывающего приложения.'],['Oura и WHOOP','Показатель и условия усреднения смотри в справке производителя. Не сравнивай ночной RMSSD напрямую с коротким SDNN.']]}},
 {...s('Как собрать сопоставимую личную базу?','Дыхание, положение тела, время суток, болезнь, алкоголь, недосып и недавняя тренировка могут менять HRV. Сначала уменьши различия условий, затем смотри на ряд за недели. Пропущенная запись — не нулевое HRV.'),steps:['Выбери один источник, метрику и похожее время измерения.','Не соединяй дневные SDNN и ночные RMSSD в одну базу.','Наблюдай несколько недель и отмечай изменения сна, нагрузки и самочувствия.','При устойчивом необычном изменении или симптомах обсуди данные с врачом.']},
 s('Что делать, если HRV упало?','Одно падение не устанавливает причину. Посмотри, не изменились ли условия записи, была ли тренировка или короткая ночь. Не назначай себе лечение и не пытайся «исправить» цифру любой ценой. Необычно высокое значение тоже не доказывает отличное восстановление.','Фита объединяет доступные показатели со сном и пульсом покоя. Когда данных недостаточно, не надо выдавать отсутствие сигнала за плохое состояние. Через MCP можно спросить ассистента о тенденции и увидеть, на каких данных основан ответ.')],
 faq:[q('HRV 20 мс — это опасно?','По одному числу с часов опасность не определяется. Нужны метрика, длительность записи, личная база и симптомы; пороги из суточной ЭКГ нельзя применять к короткой записи.'),q('Можно сравнить Apple Watch с Oura или WHOOP?','Только после проверки метрики и условий. SDNN и RMSSD напрямую не сравниваются; ночное усреднение отличается от короткого дневного измерения.'),q("Как подключить HRV к Фите?","Разреши источнику запись HRV в Apple Health или Health Connect, а Фите — чтение этой категории. В гайде устройства указана метрика и настройка обмена."),q('Среднее ± SD — это граница нормы?','Нет. Это описательный интервал из конкретного исследования, а не клинический порог и не персональная оценка.'),q('Нужно ли стремиться к максимально высокому HRV?','Нет. Сопоставимая устойчивая личная тенденция полезнее соревнования чисел; артефакты и нарушения ритма тоже могут менять показатель.')]
},{title:'HRV by Age: SDNN vs RMSSD References — FITA',description:"Compare HRV with age and sex groups from the KORA study. Explore SDNN and RMSSD references and follow your personal trend with FITA.",h1:'Heart rate variability',lead:'Choose SDNN or RMSSD, explore age-based study references and follow your personal trend.',sections:[
 {...s('What did the KORA study find by age?','KORA S4 studied 1,906 adults aged 25–74 using short resting ECG recordings. These are study references, not diagnostic limits or validated wearable thresholds.','The checker shows the published mean and mean ± one standard deviation from tables 5 and 7. It does not estimate disease risk or extrapolate outside the studied age range.'),table:{headers:['Age','SDNN women, ms','SDNN men, ms','RMSSD women, ms','RMSSD men, ms'],rows:KORA.map(b=>[`${b.from}–${b.to}`,b.f.sdnn.join(' ± '),b.m.sdnn.join(' ± '),b.f.rmssd.join(' ± '),b.m.rmssd.join(' ± ')])}},
 {...s('Why are SDNN and RMSSD different?','SDNN describes variation in normal beat intervals; RMSSD describes successive differences. A fixed conversion factor cannot correct different metrics and measurement protocols.'),table:{headers:['Data store','Relevant distinction'],rows:[['Apple Health','The HealthKit heartRateVariabilitySDNN type stores SDNN. Check the source and time.'],['Health Connect','HeartRateVariabilityRmssdRecord stores RMSSD when an authorised app writes it.'],['Oura and WHOOP','Check the vendor metric and overnight averaging; do not compare overnight RMSSD directly with short SDNN.']]}},
 {...s('How can I establish a consistent baseline?','Breathing, posture, timing, illness, alcohol, sleep and recent exercise affect HRV. Missing data is not a zero reading.'),steps:['Choose one source, metric and comparable measurement time.','Keep daytime SDNN separate from overnight RMSSD.','Review several weeks and note sleep, workload and wellbeing.','Discuss persistent unexplained changes or symptoms with a clinician.']},
 s('What should I do after a lower reading?','One lower reading does not establish a cause. Check measurement conditions and your recent activity or sleep before drawing conclusions. A high reading is not automatically better either.','FITA brings your available HRV, sleep and resting heart rate together. Connect an assistant through MCP to explore your trends in a conversation.')],faq:[q('Is 20 ms dangerous?','One wearable number cannot establish danger; metric, duration, baseline and symptoms matter.'),q('Can I compare Apple Watch with Oura or WHOOP?','Not directly when metrics or timing differ. SDNN and RMSSD are not interchangeable.'),q('Why is HRV missing in FITA?','The source may not export the required record or permissions may be missing.'),q('Is mean ± SD a normal range?','No. It is a descriptive study interval, not a clinical boundary or wearable-specific threshold.'),q('Should HRV always be as high as possible?','No. Trends under consistent conditions are more meaningful than competing with other people’s numbers.')]
},[VOSS,SHAFFER,HRVKIT,HC]),
page('zones','heart-rate-zones','zones',{
 title:'Пульсовые зоны и зона 2 — калькулятор по возрасту 2026',description:"Рассчитай 5 пульсовых зон и зону 2 по Танака, 220 − возраст или Карвонену. Бесплатный калькулятор с понятной шкалой.",h1:'Пульсовые зоны',lead:'Найди ориентир для зоны 2 и остальных зон. Это расчётная модель, а не измеренный порог.',
 sections:[{...s('Какой метод выбрать?','Танака даёт оценку максимума 208 − 0,7 × возраст. Формула основана на метаанализе и проверке на здоровых взрослых, но отдельный человек может заметно отличаться. Формула 220 − возраст — другой грубый ориентир, а не точное измерение.','Карвонен использует резерв пульса: пульс покоя + доля × (максимум − пульс покоя). В этом калькуляторе его максимум берётся по Танака. Если известен достоверно измеренный максимум, выбери отдельный режим процентов от него.'),table:{headers:['Модель','Как считается','Что означает зона 2 здесь'],rows:[['Проценты максимума','Максимум × доля','60–70% максимума'],['Карвонен, резерв','Покой + резерв × доля','60–70% резерва плюс покой'],['Измеренный максимум','Указанный максимум × доля','60–70% указанного максимума']]}},
 {...s('Какие зоны получится у взрослого 35 лет?','По Танака максимум около 184 уд/мин. В выбранной пятизонной модели ориентиры ниже. Не переносим номер зоны из одного приложения в другое без проверки его модели.'),table:{headers:['Зона','Доля максимума','Ориентир, уд/мин'],rows:[['1','50–60%','92–110'],['2','60–70%','110–128'],['3','70–80%','128–147'],['4','80–90%','147–165'],['5','90–100%','165–184']]}},
 s('Почему «зона 2» в разных приложениях не совпадает?','Разработчики используют проценты максимума, резерв пульса, пороги или собственные алгоритмы. Например, 60–70% резерва не равно 60–70% максимума. В исследованиях выносливости «зона 2» может обозначать другое относительно лактатных или вентиляционных порогов.','Смотри не только на название зоны, но и на способ расчёта. Разговорный тест и субъективная лёгкость полезны как дополнительный контекст, но не превращают калькулятор в нагрузочный тест.'),
 {...s('Как использовать результат на тренировке?','Заранее учитывай самочувствие, опыт, условия и индивидуальные ограничения. Возрастная формула не подходит для назначения безопасной интенсивности человеку с болезнью сердца или на препаратах, меняющих реакцию пульса.'),steps:['Выбери понятную модель и рассчитай ориентиры.','Сверь, какой метод использует приложение часов.','Во время нагрузки учитывай ощущения, а не только число.','Для индивидуальных тренировочных границ обсуди измерение порогов со специалистом.']},
 s('Как это связано с Фитой?','Фита читает доступные тренировки и пульс, показывает историю и позволяет обсудить нагрузку с ИИ. Рассчитай ориентиры здесь, а в приложении сравни их с историей тренировок. Через MCP Фиты можно обсудить разрешённые данные с ИИ-ассистентом.')],
 faq:[q('Зона 2 всегда равна 60–70% максимума?','Нет. Здесь это явно выбранная простая пятизонная модель; другие модели используют иные границы и физиологические пороги.'),q('Карвонен точнее для всех?','Нет универсальной гарантии. Он учитывает пульс покоя, но всё ещё зависит от оценки максимума и модели зон.'),q('Можно проверить максимальный пульс самому до предела?','Калькулятор не предлагает максимальный тест. При рисках или сомнениях согласуй обследование и нагрузку со специалистом.'),q('Что выбрать, если принимаю бета-блокатор?','Возрастные зоны могут плохо отражать реакцию на нагрузку. Нужны индивидуальные рекомендации врача.'),q('Зоны сохраняются в приложении?','Нет. Это отдельный инструмент в браузере, без сохранения или отправки введённых значений.')]
},{title:'Heart Rate Zones & Zone 2 Calculator — FITA',description:"Calculate 5 heart-rate zones and zone 2 with Tanaka, 220 minus age or Karvonen. Free calculator with a clear breakdown for training.",h1:'Heart-rate zones',lead:'Estimate zone 2 and your other training zones. These are model-based ranges, not measured thresholds.',sections:[
 {...s('Which method should I choose?','Tanaka estimates maximum heart rate as 208 − 0.7 × age. It was derived and cross-validated in healthy adults, but individuals differ. The familiar 220 − age is another rough estimate.','Karvonen uses heart-rate reserve: resting rate + fraction × (maximum − resting rate). This tool uses a Tanaka maximum for that mode; a separate mode accepts your known maximum for percent-maximum zones.'),table:{headers:['Method','Formula','Zone 2 in this tool'],rows:[['Percent maximum','Maximum × fraction','60–70% maximum'],['Karvonen','Resting + reserve × fraction','60–70% reserve + resting'],['Known maximum','Entered maximum × fraction','60–70% entered maximum']]}},
 s('Why do apps disagree about zone 2?','Apps use percent maximum, reserve, measured thresholds or proprietary models. The same zone number is not a guarantee of the same effort. Research terminology may use zones defined relative to lactate or ventilatory thresholds.','Check the model, not just the label. Comfortable speech and perceived effort add context but do not turn a calculator into an exercise test.'),
 {...s('How should I use an estimate?','Consider experience, conditions and wellbeing. Age equations are not a prescription for people with heart disease or medicines affecting heart-rate response.'),steps:['Select a model and calculate approximate boundaries.','Check which model your watch uses.','Monitor how you feel during activity as well as heart rate.','Discuss individual threshold testing and restrictions with a qualified professional.']},
 s('How does this relate to FITA?','FITA reads available workouts and pulse data to put trends in context. Calculate your reference zones here, then review your workout history in the app. With FITA MCP, you can discuss the data you choose to share with an AI assistant.')],faq:[q('Is zone 2 always 60–70% maximum?','No. That is the explicit simple five-zone convention used here; other models differ.'),q('Is Karvonen always more accurate?','No. It adds resting rate, but still depends on maximum-rate estimates and the chosen model.'),q('Should I test my maximum alone?','The tool does not recommend a maximal test. Discuss testing and risk with a qualified professional.'),q('What if I take a beta blocker?','Age-based zones may not reflect your response. Seek individual medical exercise guidance.'),q('Will this save zones to my watch?','No. The calculator runs locally in the browser and does not write to your devices.')]
},[TANAKA,TARGET]),
page('readiness','training-readiness','readiness',{
 title:'Готовность к тренировке сегодня — чекер Фиты 2026',description:"Узнай готовность 0–100 по правилам Фиты: HRV, сон и пульс покоя. Посмотри вклад каждого показателя и выбери фокус сегодняшней тренировки.",h1:'Готовность к тренировке',lead:"Сон, HRV и пульс покоя — в одном чекере готовности 0–100 по правилам Фиты. Посмотри общий результат и вклад каждого показателя.",
 sections:[{...s('Из каких компонентов складывается готовность?',"Калькулятор повторяет правила Фиты: HRV даёт до 45 очков, сон — до 35, пульс покоя — до 20. Результат помогает выбрать фокус дня вместе с самочувствием.",'Если компонента нет, он исключается из числителя и знаменателя. Для результата нужны хотя бы 50 из 100 весов; при нынешних весах это минимум два компонента. Один HRV с весом 45 не должен давать красивую оценку без сна или пульса.'),table:{headers:['Компонент','Как начисляются очки','Вес'],rows:[['HRV','Сегодня / личная база: от 0 при ≤0,6 до максимума при ≥1,0; линейно между','45'],['Сон','Доля личной цели × эффективность сна; не более веса','35'],['Пульс покоя','Максимум при ≤ личного среднего; 0 при ≥115% среднего; линейно между','20']]}},
 s('Как повторить расчёт без часов?','Введи только известные значения. Пустое поле означает отсутствие компонента. Для HRV нужны сегодняшнее значение и сопоставимая личная база одной метрики — целые миллисекунды, как в сводке Фиты. Для сна укажи именно минуты сна, отдельно минуты пробуждений; эффективность равна сон / (сон + пробуждения). Цель по умолчанию — 8 часов, её можно поменять.',"Для пульса покоя укажи свежее измерение и среднее своего ряда. Возьми сопоставимые значения за выбранный период: так результат будет полезнее для твоего сегодняшнего решения."),
 {...s('Что означают диапазоны результата?', 'Компоненты сначала округляются до целых очков, затем сумма нормируется на доступный вес. Например, только полный сон 35/35 и пульс 20/20 дают 100 при покрытии 55%; это не значит, что HRV был измерен или автоматически «хороший». Всегда смотри на покрытие.'),table:{headers:['Баллы','Подсказка Фиты'],rows:[['80–100','Высокая готовность'],['60–79','Обычная нагрузка'],['40–59','Лучше полегче'],['0–39','Приоритет восстановлению'],['Покрытие <50%','Недостаточно данных']]}},
 s("Как выбрать нагрузку с учётом готовности?","Сопоставляй готовность с самочувствием, сном и планом нагрузки. При боли, травме или выраженных симптомах обсуди тренировку с врачом.",'В приложении готовность — повод обсудить день со своей Фитой и посмотреть исходные компоненты. Через MCP разрешённая сводка доступна совместимому ИИ-ассистенту. Ассистент должен отличать измерения от пропусков, а продуктовую подсказку — от диагноза.')],
 faq:[q('Это тот же алгоритм, что в приложении?',"Да. В калькуляторе те же веса компонентов, округление и нормировка, что в приложении. Введи свежие значения своей метрики HRV, сна и пульса покоя."),q('Почему одного HRV недостаточно?','Его вес — 45%, меньше порога 50%. Нужен ещё хотя бы один доступный компонент.'),q('Почему отсутствие сна не даёт ноль за ночь?','Нет записи — не значит, что человек не спал. Пропущенный компонент исключается, а доступные нормируются.'),q('Можно сравнивать балл Фиты и WHOOP?','Нет прямого пересчёта: входы, веса и методики отличаются. Сравнивай собственную динамику в одном приложении.'),q('Высокий балл разрешает тяжёлую тренировку?','Нет. Это не медицинский допуск и не персональное назначение нагрузки.')]
},{title:'Training Readiness Checker: FITA’s 0–100 Rules',description:"Calculate FITA’s 0–100 readiness from HRV, sleep and resting heart rate. See each component and choose today’s training focus.",h1:'Training readiness',lead:"Sleep, HRV and resting heart rate in one 0–100 readiness checker, using FITA’s rules. See the total score and each component.",sections:[
 {...s('Which components determine the score?',"The calculator follows FITA’s rules: HRV contributes up to 45 points, sleep up to 35 and resting heart rate up to 20. Explore the result alongside how you feel today.",'Missing components are excluded from numerator and denominator. Coverage must reach 50% before a score appears, which requires at least two of these components.'),table:{headers:['Component','Rule','Weight'],rows:[['HRV','Today / baseline; 0 at ≤0.6, full at ≥1.0, linear between','45'],['Sleep','Fraction of personal sleep goal × asleep / (asleep + awake)','35'],['Resting rate','Full at ≤ personal mean; 0 at ≥115% mean; linear between','20']]}},
 s('What should I enter?','Only enter known values. HRV needs today’s value and a personal baseline with the same metric and protocol, in whole milliseconds as shown in the FITA snapshot. Sleep means minutes asleep, with awake minutes entered separately. The default sleep goal is eight hours and can be changed.',"For resting heart rate, enter a fresh reading and the mean from your personal series. Use comparable values from your chosen period to make today’s result useful."),
 {...s('How is missing data handled?','Components are rounded first, then the total is normalised by available weight. Full sleep and resting-rate components alone can give 100 with 55% coverage; that does not imply HRV was measured. Always read the coverage value.'),table:{headers:['Score','FITA context'],rows:[['80–100','High readiness'],['60–79','Usual load'],['40–59','Take it easier'],['0–39','Prioritise recovery'],['Coverage <50%','Insufficient data']]}},
 s("How can I use readiness for training?","Read readiness alongside how you feel, your sleep and your training plan. Discuss exercise with a clinician if you have pain, injury or concerning symptoms.",'Use FITA to discuss your day and inspect the actual inputs. FITA MCP lets compatible assistants read a permission-granted snapshot; estimates and missing data should remain distinct from measurements.')],faq:[q('Is the mathematics the same as the app?',"Yes. It uses the same component weights, rounding and normalisation as the app. Enter fresh values for your HRV metric, sleep and resting heart rate."),q('Why is HRV alone insufficient?','Its 45% weight does not meet the 50% coverage threshold.'),q('Does missing sleep count as zero sleep?','No. Missing records are excluded rather than treated as a bad night.'),q('Can I compare directly with WHOOP?','No. Different products use different inputs and algorithms.'),q('Is a high score medical clearance?','No. It is a product heuristic, not a diagnosis or exercise prescription.')]
},[source('FITA — app and available builds','https://appfita.ru/'),SHAFFER,TARGET]),
page('sync-hub','apple-health-health-connect-sync',null,{
  "title": "Как подключить часы к Фите — Apple Health и Health Connect",
  "description": "Подключи часы или кольцо к Фите: 13 гайдов для Apple Watch, Garmin, Oura, Xiaomi и других устройств. Сон, пульс и тренировки для ИИ-диалога.",
  "h1": "Твои часы и кольцо — с Фитой",
  "lead": "Apple Watch, Garmin, Oura, Xiaomi и другие устройства — собери свои данные в Фите через Apple Health на iPhone или Health Connect на Android.",
  "sections": [
    {
      "heading": "Как подключаются данные?",
      "paragraphs": [
        "Приложение часов записывает выбранные категории в системное здоровье, а Фита объединяет их для разговора о сне, пульсе и тренировках."
      ],
      "table": {
        "headers": [
          "Телефон",
          "Путь данных"
        ],
        "rows": [
          [
            "iPhone",
            "Часы или кольцо → приложение производителя → Apple Health → Фита"
          ],
          [
            "Android",
            "Часы или кольцо → приложение производителя → Health Connect → Фита"
          ]
        ]
      }
    },
    {
      "heading": "С чего начать?",
      "paragraphs": [
        "Выбери гайд своего устройства ниже и настрой один удобный путь обмена."
      ],
      "steps": [
        "Синхронизируй часы или кольцо в приложении производителя.",
        "Подключи Apple Health на iPhone или Health Connect на Android.",
        "Выбери категории записи и проверь свежую запись в системном хранилище.",
        "Разреши Фите чтение выбранных категорий.",
        "Спроси Фиту, что менялось в твоём сне, пульсе и тренировках за неделю."
      ]
    },
    {
      "heading": "Как избежать дублей?",
      "paragraphs": [
        "Для каждой категории выбери один путь записи. Например, если тренировка уже передаётся напрямую с часов, оставь её передачу через один источник. В Apple Health приоритет источников задаётся в «Источники данных и доступ»."
      ]
    },
    {
      "heading": "Что делать после подключения?",
      "paragraphs": [
        "Сравнивай личную динамику, разбирай готовность на сегодня и обсуждай связь сна с нагрузкой. Для разговора во внешнем ИИ включи MCP в профиле Фиты и выбери категории, которыми хочешь поделиться."
      ]
    }
  ],
  "faq": [
    {
      "q": "Какие устройства подключаются?",
      "a": "Выбирай часы или кольцо с передачей в Apple Health или Health Connect. Ниже — 13 гайдов по брендам и приложениям."
    },
    {
      "q": "Как проверить обмен?",
      "a": "Найди свежую запись в системном здоровье, проверь её источник и разреши Фите чтение этой категории."
    },
    {
      "q": "Когда нужен Health Sync?",
      "a": "Он даёт дополнительный путь обмена для ряда устройств. В гайдах Suunto и Huawei описана настройка; у Health Sync отдельная лицензия после пробного периода."
    },
    {
      "q": "Как открыть данные ассистенту?",
      "a": "В профиле Фиты включи «Доступ для AI-ассистентов», выбери категории и подключи MCP."
    }
  ]
},{
  "title": "Connect Your Watch to FITA: Apple Health & Health Connect",
  "description": "Connect your watch or ring to FITA: 13 guides for Apple Watch, Garmin, Oura, Xiaomi and more. Bring sleep, heart rate and workouts into AI chat.",
  "h1": "Your watch and ring, with FITA",
  "lead": "Apple Watch, Garmin, Oura, Xiaomi and more: bring your records into FITA through Apple Health on iPhone or Health Connect on Android.",
  "sections": [
    {
      "heading": "How does data reach FITA?",
      "paragraphs": [
        "Your watch app writes selected categories to your phone health store. FITA brings those records together for conversations about sleep, heart rate and training."
      ],
      "table": {
        "headers": [
          "Phone",
          "Data route"
        ],
        "rows": [
          [
            "iPhone",
            "Watch or ring → vendor app → Apple Health → FITA"
          ],
          [
            "Android",
            "Watch or ring → vendor app → Health Connect → FITA"
          ]
        ]
      }
    },
    {
      "heading": "How do you get started?",
      "paragraphs": [
        "Choose your device guide below and set up one convenient sharing route."
      ],
      "steps": [
        "Sync your watch or ring in its official app.",
        "Connect Apple Health on iPhone or Health Connect on Android.",
        "Choose writing categories and check a recent record in your phone health store.",
        "Allow FITA to read those categories.",
        "Ask FITA what changed in your sleep, heart rate and workouts this week."
      ]
    },
    {
      "heading": "How do you avoid duplicate records?",
      "paragraphs": [
        "Choose one writing route per category. For example, if workouts already sync directly from your watch, keep one sending source for those sessions. In Apple Health, set source priority in Data Sources & Access."
      ]
    },
    {
      "heading": "What comes next?",
      "paragraphs": [
        "Follow your personal trends, explore today’s readiness and discuss sleep alongside training. Enable MCP in your FITA profile and choose categories to continue with an external AI assistant."
      ]
    }
  ],
  "faq": [
    {
      "q": "Which devices can I connect?",
      "a": "Choose a watch or ring that exports to Apple Health or Health Connect. Find 13 brand and app guides below."
    },
    {
      "q": "How do I check sharing?",
      "a": "Find a recent record in your phone health store, check its source and allow FITA to read that category."
    },
    {
      "q": "When is Health Sync useful?",
      "a": "It provides another sharing route for several devices. The Suunto and Huawei guides cover setup; Health Sync has its own licence after a trial."
    },
    {
      "q": "How do I connect an assistant?",
      "a": "Enable AI assistant access in your FITA profile, choose categories and connect MCP."
    }
  ]
},[APPLE,GOOGLE,HC]),
page('tools','tools',null,{
 title:'Бесплатные калькуляторы здоровья — пульс, HRV и готовность',description:"4 бесплатных калькулятора: пульс в покое, HRV, пульсовые зоны и готовность Фиты. Быстрые расчёты в браузере, формулы и источники.",h1:'Что можно узнать по пульсу, HRV и сну?',lead:'Начни с одного вопроса о своих данных: сравни пульс, уточни метрику HRV, рассчитай зоны или повтори готовность Фиты. Инструменты бесплатны, считают в браузере и не сохраняют введённые значения.',sections:[s('Какой инструмент выбрать?',"Пульс в покое сравнивается с взрослым диапазоном, HRV — с исследовательскими группами той же метрики. Пульсовые зоны зависят от выбранной модели, а готовность повторяет правила Фиты. Выбери инструмент под свой вопрос."),s('Как перейти от одного числа к своим данным?',"Подключи устройство через Apple Health или Health Connect и проверь доступные метрики. В Фите можно обсудить тенденцию со сном и нагрузкой; MCP Фиты открывает разрешённую сводку совместимому ИИ-ассистенту.")],faq:[q('Нужна регистрация?','Для веб-калькуляторов нет. Для доступа к личным данным через приложение и MCP нужна авторизация и разрешения.'),q('Это медицинские инструменты?','Нет, справочные калькуляторы и объяснения. Они не устанавливают диагноз и не назначают лечение.'),q('Данные сохраняются?','Введённые в калькуляторы значения не сохраняются и не отправляются.'),q('Где найти приложение?','iOS — в российском App Store; Android и настольные сборки — на releases.appfita.ru. Идёт закрытая бета.')]
},{title:'Free Health Calculators: Pulse, HRV & Readiness — FITA',description:"4 free health calculators: resting pulse, HRV, training zones and FITA readiness. Quick browser results with clear formulas and sources.",h1:'What can pulse, HRV and sleep tell you?',lead:'Start with one question: check resting pulse, identify your HRV metric, estimate zones or reproduce FITA readiness. These free tools calculate locally without saving input values.',sections:[s('Which tool should I choose?',"Resting pulse uses an adult reference; HRV uses study groups for the same metric. Training zones follow your chosen model, while readiness uses FITA’s rules. Choose a tool for your question."),s('How do I work with my own data?','Connect your device through Apple Health or Health Connect and check which records arrive. FITA puts available trends in context, and FITA MCP provides a permission-based snapshot for compatible assistants.')],faq:[q('Do I need an account?','Not for the web calculators. Personal app data and MCP access require authentication and permission.'),q('Are these medical tests?','No. These educational tools cannot diagnose or prescribe treatment.'),q('Are inputs saved?','No. Calculator values are neither saved nor sent.'),q('Where can I find FITA?','iOS is available in the Russian App Store; Android and desktop builds are on releases.appfita.ru. FITA is in closed beta.')]
},[AHA,VOSS,TANAKA,APPLE,GOOGLE])
];
