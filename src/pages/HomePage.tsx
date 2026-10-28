import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Droplets, ExternalLink, ShieldCheck, Sun, Thermometer, Wind } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUpdates } from '../context/UpdatesContext';
import { useRegion } from '../context/RegionContext';
import { countries, globalWeatherSource } from '../data/regions';
import { RegionSelector } from '../components/RegionSelector';
import { isPromotionActive } from '../services/promotions';
import { SEOHead } from '../components/SEOHead';
import { WeatherWidget } from '../components/WeatherWidget';
const heroImage = new URL('../../image/el-nino-hero.webp', import.meta.url).href;
const pacificSchematic = new URL('../../image/enso-pacific-warm-phase.svg', import.meta.url).href;
const globalWeatherSchematic = new URL('../../image/enso-global-weather-schematic.svg', import.meta.url).href;

export const HomePage: React.FC = () => {
  const { language, isTelugu } = useLanguage();
  const { publishedUpdates, products, publishedContent, visiblePages } = useUpdates();
  const { countryCode, countryName, regionName } = useRegion();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const homepageSettings = [...publishedContent].reverse().find((entry) => entry.kind === 'page' && entry.pagePath === '/');
  const regionalGuidance = publishedContent.filter((entry) => {
    if (entry.kind !== 'content' || entry.category !== 'regional-guidance' || entry.pagePath !== '/') return false;
    const markets = entry.availableCountries?.split(',').map((code) => code.trim()).filter(Boolean) || [];
    return countryCode === 'global' ? markets.includes('*') : markets.includes('*') || markets.includes(countryCode);
  });
  const regionProducts = useMemo(() => products.filter((product) => {
    const markets = product.availableCountries || [];
    const hasDisplayPrice = Boolean(product.price && product.currency);
    return hasDisplayPrice && (countryCode === 'global' ? markets.includes('*') : markets.includes('*') || markets.includes(countryCode));
  }).sort((a, b) => {
    const currentRisks = new Set(publishedUpdates
      .filter((update) => !update.countries?.length || update.countries.includes('*') || update.countries.includes(countryCode))
      .flatMap((update) => update.climateRisks || [])
      .concat(regionalGuidance.flatMap((entry) => entry.climateRisks?.split(',').map((risk) => risk.trim()) || [])));
    const aScore = (a.climateRisks || []).filter((risk) => currentRisks.has(risk)).length;
    const bScore = (b.climateRisks || []).filter((risk) => currentRisks.has(risk)).length;
    return bScore - aScore;
  }), [countryCode, products, publishedUpdates, regionalGuidance]);
  const currentProduct = regionProducts.length ? regionProducts[carouselIndex % regionProducts.length] : undefined;
  const regionUpdates = publishedUpdates.filter((update) => {
    const markets = update.countries || [];
    return countryCode === 'global' ? markets.length === 0 || markets.includes('*') : markets.length === 0 || markets.includes('*') || markets.includes(countryCode);
  });
  const country = countries.find((item) => item.code === countryCode);

  useEffect(() => {
    setCarouselIndex(0);
  }, [countryCode]);

  useEffect(() => {
    if (regionProducts.length < 2) return;
    const timer = window.setInterval(() => setCarouselIndex((index) => (index + 1) % regionProducts.length), 6000);
    return () => window.clearInterval(timer);
  }, [regionProducts.length]);
  const text = isTelugu
    ? {
        badge: 'సులభమైన వాతావరణ సమాచారం',
        title: 'ఎల్ నినో గురించి తెలుసుకోండి. మీ కుటుంబాన్ని సిద్ధం చేసుకోండి.',
        intro: 'ఎల్ నినో ప్రపంచంలోని వర్షాలు, వేడి మరియు నీటి లభ్యతను మార్చవచ్చు. సులభమైన సమాచారం, భద్రతా సూచనలు, మరియు అధికారిక వార్తలను ఇక్కడ చూడండి.',
        what: 'ఎల్ నినో అంటే ఏమిటి?',
        whatBody: 'పసిఫిక్ మహాసముద్రంలోని కొన్ని ప్రాంతాలు సాధారణం కంటే వేడిగా ఉండే సహజ వాతావరణ మార్పు ఇది. ఇది కొన్ని నెలల పాటు ప్రపంచంలోని వాతావరణాన్ని మార్చవచ్చు.',
        impacts: 'ప్రపంచ వాతావరణంపై ప్రభావాలు',
        safety: 'మీరు చేయగలిగే భద్రతా పనులు',
        temperature: 'ఇప్పటి స్థానిక ఉష్ణోగ్రత',
        updates: 'తాజా అధికారిక సమాచారం',
        noUpdates: 'కొత్తగా ప్రచురించిన సమాచారం లేదు.',
        heat: 'మీ ప్రాంతంలో వేడి పెరగవచ్చు. ఎక్కువగా నీరు తాగండి, నీడలో ఉండండి.',
        rain: 'కొన్ని చోట్ల భారీ వర్షం, వరదలు రావచ్చు. హెచ్చరికలను గమనించండి.',
        dry: 'కొన్ని చోట్ల తక్కువ వర్షం, నీటి కొరత ఉండవచ్చు. నీటిని ఆదా చేయండి.',
        tip1: 'వేడి సమయంలో బయట పని తగ్గించి, నీరు తాగుతూ ఉండండి.',
        tip2: 'స్థానిక వాతావరణ శాఖ హెచ్చరికలు, సూచనలను పాటించండి.',
        tip3: 'శుభ్రమైన తాగునీరు, అవసరమైన మందులు సిద్ధంగా ఉంచండి.',
        cta: 'ప్రభావాలు మరియు భద్రతా సూచనలు',
        sources: 'అధికారిక మూలాలు',
        sourceNote: 'మీ ప్రాంతానికి సంబంధించిన తాజా సూచనల కోసం అధికారిక వాతావరణ శాఖను చూడండి.',
        published: 'ప్రచురించిన తేదీ',
        source: 'మూలం చూడండి',
      }
    : language === 'es'
    ? {
        badge: 'Información meteorológica sencilla',
        title: 'Comprenda El Niño. Prepare a su familia.',
        intro: 'El Niño puede cambiar las lluvias, el calor y el suministro de agua en distintas partes del mundo. Aquí encontrará información clara, consejos de seguridad y fuentes oficiales.',
        what: '¿Qué es El Niño?',
        whatBody: 'El Niño es un cambio natural que calienta más de lo habitual algunas zonas del océano Pacífico y puede modificar el tiempo durante varios meses.',
        impacts: 'Cómo puede cambiar el tiempo en el mundo',
        safety: 'Formas sencillas de mantenerse a salvo',
        temperature: 'Temperatura local',
        updates: 'Últimas actualizaciones oficiales',
        noUpdates: 'No hay nuevas actualizaciones publicadas.',
        heat: 'Algunos lugares pueden tener más días calurosos. Beba agua y descanse a la sombra.',
        rain: 'Algunos lugares pueden sufrir lluvias intensas e inundaciones. Consulte los avisos locales.',
        dry: 'Algunos lugares pueden recibir menos lluvia y tener escasez de agua. Ahorre agua.',
        tip1: 'Descanse a la sombra y beba agua cuando haga calor.',
        tip2: 'Siga las alertas de los servicios meteorológicos y de emergencia locales.',
        tip3: 'Tenga preparada agua potable segura y sus medicamentos importantes.',
        cta: 'Ver impactos y consejos de seguridad',
        sources: 'Fuentes oficiales',
        sourceNote: 'Consulte el servicio meteorológico nacional para conocer las recomendaciones más recientes.',
        published: 'Publicado',
        source: 'Leer la fuente',
      }
    : {
        badge: 'Weather information made simple',
        title: 'Understand El Niño. Help your family get ready.',
        intro: 'El Niño can change rain, heat, and water supplies around the world. Find clear information, safety tips, and official updates here.',
        what: 'What is El Niño?',
        whatBody: 'El Niño is a natural change that makes parts of the Pacific Ocean warmer than usual. It can change weather in many places for several months.',
        impacts: 'How weather can change around the world',
        safety: 'Simple ways to stay safe',
        temperature: 'Temperature where you are now',
        updates: 'Latest official updates',
        noUpdates: 'There are no newly published updates.',
        heat: 'Some places may have more hot days. Drink water and rest in the shade.',
        rain: 'Some places may get heavy rain and floods. Watch local warnings.',
        dry: 'Some places may get less rain and have water shortages. Save water.',
        tip1: 'Take breaks in the shade and drink water during hot weather.',
        tip2: 'Follow alerts from your local weather and emergency services.',
        tip3: 'Keep safe drinking water and important medicines ready.',
        cta: 'See impacts and safety tips',
        sources: 'Official sources',
        sourceNote: 'Check your national weather service for the latest advice in your area.',
        published: 'Published',
        source: 'Read source',
      };

  const history = isTelugu
    ? {
        title: 'ఎల్ నినో చరిత్ర',
        intro: 'ఎల్ నినో (“బాలుడు”) అనే పేరు పెరూ, ఈక్వడార్ తీరాల మత్స్యకారులు క్రిస్మస్ సమయానికి కనిపించే వెచ్చని సముద్ర ప్రవాహానికి పెట్టిన పేరునుంచి వచ్చింది; అది బాల యేసును సూచిస్తుంది. నేడు, ఇది ENSOలోని వెచ్చని దశను సూచిస్తుంది: ఉష్ణమండల మధ్య మరియు తూర్పు పసిఫిక్‌లో సముద్ర ఉపరితల ఉష్ణోగ్రతలు సాధారణం కంటే ఎక్కువగా ఉండి, వాతావరణ ప్రసరణతో అనుసంధానమై ఉంటాయి.',
        timeline: 'ప్రధాన ఎల్ నినో సంఘటనలు',
        pacificCaption: 'మధ్య, తూర్పు భూమధ్య రేఖ పసిఫిక్‌లోని వెచ్చదనం మరియు గాలి మార్పుల సరళీకృత చిత్రం; ఇది పరిశీలించిన డేటా మ్యాప్ కాదు.',
        globalCaption: 'ఉదాహరణాత్మక వాతావరణ ప్రభావాలు; ప్రాంతానుసారంగా ఫలితాలు మారుతాయి.',
        globalTitle: 'ప్రపంచ వాతావరణంపై ప్రభావం',
        globalText: 'ఎల్ నినో పసిఫిక్‌లోని ఉష్ణప్రసరణ, వాకర్ ప్రసరణను మార్చి, ప్రపంచవ్యాప్తంగా వర్షపాతం, ఉష్ణోగ్రత ధోరణులపై ప్రభావం చూపగలదు. పెరూ, ఈక్వడార్‌లోని కొన్ని ప్రాంతాల్లో ఎక్కువ వర్షం, ఇండోనేషియా మరియు ఆస్ట్రేలియాలోని కొన్ని ప్రాంతాల్లో పొడి పరిస్థితులు ఏర్పడే అవకాశం ఉంటుంది. ఇవి సాధారణ ధోరణులు మాత్రమే—ప్రతి సంఘటన, ప్రాంతం ఒకేలా ఉండవు.',
        indiaTitle: 'భారతదేశ రుతుపవనాలు',
        indiaText: 'ఎల్ నినో సమయంలో భారతదేశ నైరుతి రుతుపవనాల్లో తక్కువ వర్షపాతం వచ్చే అవకాశం పెరుగుతుంది; కానీ అది ఖచ్చితమైన ఫలితం కాదు. హిందూ మహాసముద్ర ద్విధ్రువం, ప్రాంతీయ గాలులు, రుతుపవనాల కాలానుగుణ మార్పులు కూడా ప్రభావితం చేస్తాయి. 1997లో బలమైన ఎల్ నినో ఉన్నప్పటికీ భారత రుతుపవన వర్షపాతం సుమారు సాధారణ స్థాయిలోనే ఉంది. 2015లో ఇది దీర్ఘకాల సగటులో సుమారు 86% కాగా, 2023లో 94.4%గా నమోదైంది; దేశవ్యాప్తంగా పంపిణీ కూడా మారింది.',
        events: [
          { year: '1982–83', title: 'అత్యంత బలమైన సంఘటనల్లో ఒకటి', detail: 'పెరూ, ఈక్వడార్‌లోని కొన్ని ప్రాంతాల్లో భారీ వర్షాలు, వరదలు వచ్చాయి; ఇండోనేషియా, ఆస్ట్రేలియాలోని కొన్ని ప్రాంతాల్లో కరువు, పంటలపై ఒత్తిడి పెరిగింది. ప్రపంచ వాతావరణ నమూనాలపై కూడా విస్తృత ప్రభావం చూపింది.' },
          { year: '1997–98', title: 'తీవ్రమైన ఎల్ నినో', detail: 'పెరూ, ఈక్వడార్‌లో వరదలు, ఇండోనేషియాలో కరువు మరియు అగ్నిప్రమాదాలు నమోదయ్యాయి. భారతదేశంలో 1997 రుతుపవనాలు సుమారు సాధారణంగా ఉండటం, ఎల్ నినో ప్రభావం ప్రతి ఏడాది ఒకేలా ఉండదని చూపిస్తుంది.' },
          { year: '2015–16', title: 'రికార్డు స్థాయి బలమైన సంఘటన', detail: 'ప్రపంచవ్యాప్తంగా అధిక ఉష్ణోగ్రతలు, ప్రాంతానుసారంగా వర్షపాతం మార్పులు నమోదయ్యాయి. 2015లో భారతదేశ రుతుపవన వర్షపాతం దీర్ఘకాల సగటులో సుమారు 86%గా ఉంది.' },
          { year: '2023–24', title: 'బలమైన, ఇటీవలి సంఘటన', detail: '2023 చివర్లో గరిష్ఠ స్థాయికి చేరి 2024 ప్రారంభం వరకు కొనసాగింది. 2023లో భారతదేశ రుతుపవన వర్షపాతం దీర్ఘకాల సగటులో 94.4%గా నమోదైంది; ప్రాంతాల మధ్య తేడాలు గణనీయంగా ఉన్నాయి.' },
        ],
        sources: 'NOAA ఎల్ నినో వనరులు',
        indiaSource: 'భారత వాతావరణ శాఖ (IMD)',
      }
    : language === 'es'
    ? {
        title: 'Historia de El Niño',
        intro: 'El nombre El Niño (“el niño”) fue usado por pescadores de las costas de Perú y Ecuador para una corriente cálida que aparecía cerca de Navidad, en alusión al Niño Jesús. Hoy describe la fase cálida del ENOS: temperaturas superficiales del mar más altas de lo habitual en el Pacífico ecuatorial central y oriental, vinculadas a cambios atmosféricos.',
        timeline: 'Episodios importantes de El Niño',
        pacificCaption: 'Esquema simplificado del calentamiento y los vientos en el Pacífico ecuatorial central y oriental; no es un mapa de datos observados.',
        globalCaption: 'Ejemplos de influencias climáticas; los efectos varían según la región.',
        globalTitle: 'Efectos en el tiempo mundial',
        globalText: 'El Niño altera la convección tropical y la circulación de Walker, y puede cambiar los patrones de lluvia y temperatura en muchas regiones. Puede favorecer más lluvia en partes de Perú y Ecuador y condiciones más secas en partes de Indonesia y Australia. Son tendencias, no resultados garantizados: cada episodio y región es diferente.',
        indiaTitle: 'El monzón de India',
        indiaText: 'El Niño aumenta la probabilidad de lluvias por debajo de lo normal durante el monzón del suroeste de India, pero no determina el resultado. También influyen el dipolo del océano Índico, la circulación regional y la variabilidad estacional. En 1997, pese a El Niño fuerte, las lluvias monzónicas de India estuvieron cerca de lo normal. En 2015 fueron aproximadamente el 86% del promedio de largo plazo y en 2023 el 94,4%, con variaciones regionales.',
        events: [
          { year: '1982–83', title: 'Uno de los episodios más intensos', detail: 'Hubo lluvias e inundaciones en partes de Perú y Ecuador, y sequía, estrés agrícola e incendios en partes de Indonesia y Australia. El episodio también tuvo amplias repercusiones climáticas mundiales.' },
          { year: '1997–98', title: 'Un episodio muy intenso', detail: 'Se produjeron inundaciones en partes de Perú y Ecuador, y sequía e incendios en Indonesia. El monzón de India de 1997 fue aproximadamente normal, ejemplo de que el efecto de El Niño no es igual cada año.' },
          { year: '2015–16', title: 'Entre los más fuertes registrados', detail: 'Se registraron temperaturas globales muy altas y cambios de lluvia según la región. En 2015, las lluvias del monzón de India fueron aproximadamente el 86% del promedio de largo plazo.' },
          { year: '2023–24', title: 'Un episodio fuerte reciente', detail: 'Alcanzó su máximo a finales de 2023 y continuó a comienzos de 2024. Las lluvias del monzón de India en 2023 llegaron al 94,4% del promedio de largo plazo, con diferencias importantes entre regiones.' },
        ],
        sources: 'Recursos de NOAA sobre El Niño',
        indiaSource: 'Departamento Meteorológico de India (IMD)',
      }
    : {
        title: 'History of El Niño',
        intro: 'The name El Niño (“the boy”) was used by fishers off Peru and Ecuador for a warm ocean current that appeared near Christmas, referring to the Christ Child. Today it names the warm phase of ENSO: unusually warm sea-surface temperatures in the central and eastern equatorial Pacific coupled with changes in the atmosphere.',
        timeline: 'Major El Niño events',
        pacificCaption: 'Simplified illustration of warming and winds in the central and eastern equatorial Pacific; this is not an observed-data map.',
        globalCaption: 'Illustrative climate influences; outcomes vary by region.',
        globalTitle: 'Effects on global weather',
        globalText: 'El Niño shifts tropical convection and the Walker circulation, changing rainfall and temperature patterns in many regions. It often favors wetter conditions in parts of Peru and Ecuador and drier conditions in parts of Indonesia and Australia. These are tendencies, not guarantees: impacts differ by event and location.',
        indiaTitle: 'India’s monsoon',
        indiaText: 'El Niño raises the odds of below-average rainfall during India’s southwest monsoon, but it does not determine the season. The Indian Ocean Dipole, regional circulation, and monsoon variability also matter. India’s 1997 monsoon was near normal despite a strong El Niño. Rainfall was about 86% of the long-period average in 2015 and 94.4% in 2023, with substantial regional variation.',
        events: [
          { year: '1982–83', title: 'One of the strongest events observed', detail: 'Heavy rain and flooding affected parts of Peru and Ecuador, while drought, crop stress, and fires affected parts of Indonesia and Australia. The event also produced far-reaching global climate effects.' },
          { year: '1997–98', title: 'A very strong event', detail: 'Flooding affected parts of Peru and Ecuador; drought and fires occurred in Indonesia. India’s 1997 monsoon was near normal, showing that El Niño’s influence is not the same every year.' },
          { year: '2015–16', title: 'Among the strongest on record', detail: 'Global temperatures were exceptionally high, with rainfall shifts across regions. India’s 2015 monsoon rainfall was about 86% of its long-period average.' },
          { year: '2023–24', title: 'A recent strong event', detail: 'It peaked in late 2023 and continued into early 2024. India’s 2023 monsoon rainfall was 94.4% of its long-period average, with notable variation across the country.' },
        ],
        sources: 'NOAA El Niño resources',
        indiaSource: 'India Meteorological Department (IMD)',
      };

  return (
    <>
      <SEOHead
        titleEn="Simple El Niño Information, Weather and Safety Tips"
        titleTe="ఎల్ నినో సమాచారం, వాతావరణం మరియు భద్రతా సూచనలు"
        titleEs="Información, tiempo y consejos de seguridad sobre El Niño"
        descriptionEn="Simple information about El Niño, possible worldwide weather changes, local temperature, safety tips, and official updates."
        descriptionTe="ఎల్ నినో, ప్రపంచ వాతావరణ మార్పులు, స్థానిక ఉష్ణోగ్రత, భద్రతా సూచనలు మరియు అధికారిక సమాచారం."
        descriptionEs="Información sencilla sobre El Niño, los posibles cambios del tiempo, la temperatura local, la seguridad y las actualizaciones oficiales."
      />

      {visiblePages.includes('/products') && currentProduct && (
        <section aria-label={isTelugu ? 'సంసిద్ధత ఉత్పత్తులు' : 'Preparedness product advertisement'} className="bg-slate-950 px-4 py-3 text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-5">
            <button type="button" aria-label="Previous product" onClick={() => setCarouselIndex((index) => (index - 1 + regionProducts.length) % regionProducts.length)} className="rounded-full p-2 text-white/80 hover:bg-white/10 disabled:opacity-40" disabled={regionProducts.length < 2}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Link to="/products" className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
              <img src={currentProduct.imageUrl} alt="" className="h-14 w-16 shrink-0 rounded-lg object-cover sm:h-16 sm:w-24" />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-teal-300">{isTelugu ? 'ప్రాంతానికి సరిపోయే ఉత్పత్తులు' : language === 'es' ? 'Para su región' : 'For your region'}</span>
                <span className="mt-1 block truncate text-sm font-bold sm:text-base">{isTelugu ? currentProduct.titleTe || currentProduct.name : language === 'es' ? currentProduct.titleEs || currentProduct.name : currentProduct.name}</span>
                <span className="mt-1 block text-xs text-slate-300">{[currentProduct.price && [currentProduct.price, currentProduct.currency].filter(Boolean).join(' '), currentProduct.offer && isPromotionActive(currentProduct.offerExpiresAt) ? language === 'es' ? currentProduct.offerEs || currentProduct.offer : currentProduct.offer : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="hidden text-sm font-semibold text-teal-300 sm:inline">{isTelugu ? 'వివరాలు' : language === 'es' ? 'Ver detalles' : 'View details'} <span aria-hidden="true">→</span></span>
            </Link>
            <button type="button" aria-label="Next product" onClick={() => setCarouselIndex((index) => (index + 1) % regionProducts.length)} className="rounded-full p-2 text-white/80 hover:bg-white/10 disabled:opacity-40" disabled={regionProducts.length < 2}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      )}

      <section
        className="relative overflow-hidden border-b border-slate-200/60 bg-cover bg-center bg-no-repeat px-4 py-14 sm:py-20"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.58) 58%, rgba(2, 6, 23, 0.36)), url("${homepageSettings?.imageUrl || heroImage}")`,
        }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/35 px-3.5 py-1.5 text-xs font-semibold text-white">
            <ShieldCheck className="h-4 w-4" /> {homepageSettings?.badge || text.badge}
          </span>
          <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">{isTelugu ? homepageSettings?.titleTe || text.title : language === 'es' ? homepageSettings?.titleEs || text.title : homepageSettings?.titleEn || text.title}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">{isTelugu ? homepageSettings?.descriptionTe || text.intro : language === 'es' ? homepageSettings?.descriptionEs || text.intro : homepageSettings?.descriptionEn || text.intro}</p>
          {visiblePages.includes('/global-impact-safety') && (
            <Link to="/global-impact-safety" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-blue-700 px-5 py-3 font-semibold text-white shadow-md shadow-blue-900/15 transition-all hover:brightness-95">
              {text.cta}<ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-7 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{isTelugu ? 'మీ ప్రాంతానికి సంబంధించిన సమాచారం' : language === 'es' ? `Información regional${countryCode !== 'global' ? ` · ${countryName}` : ''}` : `Regional information${countryCode !== 'global' ? ` · ${countryName}` : ''}`}</h2>
              <p className="mt-1 text-sm text-slate-600">{isTelugu ? 'ప్రాంతాన్ని ఎంచుకుని ప్రచురించిన అధికారిక సమాచారం చూడండి.' : language === 'es' ? `Región: ${regionName}. Son avisos publicados con fuentes, no pronósticos en directo.` : `Region: ${regionName}. These are published, source-linked updates—not live forecasts.`}</p>
            </div>
            <RegionSelector label={isTelugu ? 'దేశం లేదా ప్రాంతాన్ని ఎంచుకోండి' : language === 'es' ? 'Seleccione un país o región' : 'Select country or region'} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <a href={country?.officialWeatherUrl || globalWeatherSource} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ocean-700 hover:underline">
              {isTelugu ? 'అధికారిక వాతావరణ శాఖ హెచ్చరికలు' : language === 'es' ? 'Avisos meteorológicos y consejos oficiales' : 'Open official weather and safety guidance'}<ExternalLink className="h-4 w-4" />
            </a>
            {visiblePages.includes('/products') && <Link to="/products" className="text-sm font-semibold text-ocean-700 hover:underline">{isTelugu ? 'ప్రాంతీయ ఉత్పత్తులను చూడండి' : language === 'es' ? 'Ver productos indicados para esta región' : 'See products listed for this region'} <span aria-hidden="true">→</span></Link>}
          </div>
          {regionUpdates.length > 0 || regionalGuidance.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {regionalGuidance.slice(0, 4).map((guidance) => (
                <article key={guidance.id} className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-800">{isTelugu ? 'ప్రాంతీయ సలహా' : language === 'es' ? 'Consejos regionales' : 'Regional preparedness guidance'}</p>
                  <h3 className="mt-1 font-semibold text-slate-900">{isTelugu ? guidance.titleTe || guidance.titleEn : language === 'es' ? guidance.titleEs || guidance.titleEn : guidance.titleEn}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{isTelugu ? guidance.descriptionTe || guidance.descriptionEn : language === 'es' ? guidance.descriptionEs || guidance.descriptionEn : guidance.descriptionEn}</p>
                  {guidance.sourceUrl && <a href={guidance.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ocean-700 hover:underline">{guidance.sourceName || (language === 'es' ? 'Fuente oficial' : 'Official source')} <ExternalLink className="h-3 w-3" /></a>}
                </article>
              ))}
              {regionUpdates.slice(0, 2).map((update) => (
                <article key={update.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">{update.sourceName || 'Published update'} · {update.date}</p>
                  <h3 className="mt-1 font-semibold text-slate-900">{isTelugu ? update.titleTe || update.titleEn : language === 'es' ? update.titleEs || update.titleEn : update.titleEn}</h3>
                  <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ocean-700 hover:underline">{isTelugu ? 'మూలాన్ని చూడండి' : language === 'es' ? 'Ver fuente oficial' : 'View official source'} <ExternalLink className="h-3 w-3" /></a>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{isTelugu ? 'ఈ ప్రాంతానికి ప్రచురించిన సమాచారం లేదు. తాజా హెచ్చరికల కోసం అధికారిక వాతావరణ శాఖను చూడండి.' : language === 'es' ? 'Aún no hay avisos publicados para esta región. Consulte la fuente oficial enlazada para ver las alertas vigentes.' : 'No updates have been published for this region yet. Check the linked official source for current warnings.'}</p>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-14">
        <article className="rounded-2xl border border-ocean-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-ocean-50 text-ocean-700"><Wind className="h-6 w-6" /></div>
          <h2 className="text-2xl font-bold text-slate-900">{text.what}</h2>
          <p className="mt-3 leading-relaxed text-slate-600">{text.whatBody}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-5 text-2xl font-bold text-slate-900">{text.impacts}</h2>
          <ul className="space-y-4 text-sm leading-relaxed text-slate-700">
            <li className="flex gap-3"><Sun className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />{text.heat}</li>
            <li className="flex gap-3"><Wind className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />{text.rain}</li>
            <li className="flex gap-3"><Droplets className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />{text.dry}</li>
          </ul>
        </article>
      </section>

      <section className="border-y border-slate-200/70 bg-slate-50/70 py-10 sm:py-12" aria-labelledby="enso-history-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wider text-ocean-700">ENSO · Ocean and atmosphere</p>
            <h2 id="enso-history-title" className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{history.title}</h2>
            <p className="mt-3 leading-relaxed text-slate-600">{history.intro}</p>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <figure className="overflow-hidden rounded-2xl border border-ocean-100 bg-white shadow-sm">
              <img src={pacificSchematic} alt={history.pacificCaption} loading="lazy" className="w-full" />
              <figcaption className="border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-500 sm:px-5">{history.pacificCaption}</figcaption>
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img src={globalWeatherSchematic} alt={history.globalCaption} loading="lazy" className="w-full" />
              <figcaption className="border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-500 sm:px-5">{history.globalCaption}</figcaption>
            </figure>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h3 className="mb-6 text-xl font-bold text-slate-900">{history.timeline}</h3>
              <ol className="relative space-y-5 border-l-2 border-ocean-100 pl-5 sm:pl-7">
                {history.events.map((event) => (
                  <li key={event.year} className="relative">
                    <span aria-hidden="true" className="absolute -left-[1.68rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-ocean-600 ring-2 ring-ocean-100 sm:-left-[2.18rem]" />
                    <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                      <p className="text-sm font-extrabold tracking-wide text-ocean-700">{event.year}</p>
                      <h4 className="mt-1 font-bold text-slate-900">{event.title}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{event.detail}</p>
                    </article>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-5">
              <article className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-lg font-bold text-slate-900">{history.globalTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{history.globalText}</p>
              </article>
              <article className="rounded-2xl border border-teal-100 bg-teal-50/60 p-5 sm:p-6">
                <h3 className="text-lg font-bold text-slate-900">{history.indiaTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{history.indiaText}</p>
                <a href="https://mausam.imd.gov.in/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ocean-700 hover:underline">
                  {history.indiaSource}<ExternalLink className="h-3.5 w-3.5" />
                </a>
              </article>
            </div>
          </div>

          <a href="https://www.noaa.gov/education/resource-collections/weather-atmosphere/el-nino" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ocean-700 hover:underline">
            {history.sources}<ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-slate-50/70 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">{text.safety}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[text.tip1, text.tip2, text.tip3].map((tip, index) => (
              <div key={tip} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800">{index + 1}</span>{tip}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-5 flex items-center gap-2"><Thermometer className="h-5 w-5 text-rose-600" /><h2 className="text-2xl font-bold text-slate-900">{text.temperature}</h2></div>
        <WeatherWidget />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-900">{text.updates}</h2>
          <a href="https://wmo.int/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-ocean-700 hover:underline">{text.sources}<ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
        <p className="mb-5 text-sm text-slate-600">{text.sourceNote}</p>
        {publishedUpdates.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">{text.noUpdates}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {publishedUpdates.slice(0, 4).map((update) => (
              <article key={update.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-slate-500">{text.published}: {update.date}</p>
                <h3 className="mt-2 font-bold text-slate-900">{isTelugu ? update.titleTe : update.titleEn}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{isTelugu ? update.descriptionTe : update.descriptionEn}</p>
                <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ocean-700 hover:underline">{text.source}<ExternalLink className="h-3 w-3" /></a>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
};
