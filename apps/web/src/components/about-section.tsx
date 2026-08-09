import type { AppLocale } from "@/i18n/config";
import { PUBLICATION_DISPLAY_TIME } from "@/lib/site/publication-display";

const zhPath = ["认识自己", "接纳自己", "成为自己", "活出自己"];
const enPath = ["Know yourself", "Accept yourself", "Become yourself", "Live as yourself"];

const zhPrinciples = [
  ["一休", "先照顾身体，安顿情绪，再继续前行。"],
  ["不二", "接纳高峰与低谷，拥抱完整而非完美。"],
  ["三慢", "慢下来、慢慢来、慢慢成为，尊重生命的节奏。"],
  ["如水", "向内扎根，向外流动；顺应变化，不失本心。"],
];

const enPrinciples = [
  ["Pause", "Care for the body, settle emotion, then continue."],
  ["Wholeness", "Accept peaks and valleys; choose wholeness over perfection."],
  ["Go slowly", "Slow down, take your time, and respect the rhythm of becoming."],
  ["Be Water", "Root inwardly, move outwardly; adapt without losing your center."],
];

export function AboutCopy({ locale, includePhilosophy = false }: { locale: AppLocale; includePhilosophy?: boolean }) {
  const isZh = locale === "zh";
  const timeLabel = PUBLICATION_DISPLAY_TIME;
  const path = isZh ? zhPath : enPath;
  const principles = isZh ? zhPrinciples : enPrinciples;

  return (
    <>
      <div className="about-copy">
        {isZh ? (
          <>
            <p>这个世界每天都很热闹，也很容易把人带跑。</p>
            <p>AI又进化到了哪一步，谁在谈判，谁在发射火箭，谁又悄悄改写了未来……信息像潮水一样涌来，浪花很大，真正重要的变化却常常藏在水面之下。</p>
            <p>所以，我们做了「虾子曰」。每天 {timeLabel}，从全球新闻里筛出最值得关注的 8 件事，再配上 1 张今日总览：先把事实讲清楚，再把门道说明白，配上简短介绍、推荐阅读和可以保存分享的中英文海报。</p>
            <p>我们想用一点烟火气，讲商业、人性与时代变化。不装深刻，不贩焦虑，不带节奏，也不急着替复杂世界下结论。</p>
            <p>虾子曰负责看门道，豆豆龙负责说人话，偶尔补一刀，也始终留一点余地。幽默但不油滑，犀利但不刻薄，达观但不犬儒，通俗但不浅薄。</p>
            <p>有趣是入口，中正是底色，洞察是价值。我们只想讲看得见的人性、想得透的逻辑，以及真正落得下的启发。</p>
            <p className="about-credo">虾子曰：虾说，不瞎说。</p>
            <p>世事如潮，别被浪花带跑。每天看懂世界上最重要的 8 件事，也许就够了。剩下的时间，去工作，去陪家人，去晒太阳，去好好生活。</p>
          </>
        ) : (
          <>
            <p>The world is loud, busy, and very good at pulling us off course.</p>
            <p>The next leap in AI, negotiations, rocket launches, and quiet decisions that may reshape the future: information arrives like a tide. The splash gets attention, while the changes that matter often move beneath the surface.</p>
            <p>Every day at {timeLabel} Beijing time, Xiazi Says selects the 8 global stories that matter most and pairs them with 1 daily overview. We clarify the facts, explain what lies beneath them, and provide concise context, recommended reading, and bilingual posters made to save and share.</p>
            <p>We bring everyday warmth to clear-eyed observations about business, human nature, and a changing world. No borrowed profundity, manufactured anxiety, engineered outrage, or rushed verdicts.</p>
            <p>Xiazi looks beneath the surface. Doudoulong speaks plainly and occasionally lands a sharp punchline, always leaving room for complexity. Humorous, never slick. Sharp, never cruel. Optimistic, never cynical. Accessible, never shallow.</p>
            <p>Interest opens the door. Balance sets the tone. Insight creates the value. We focus on visible human nature, sound reasoning, and ideas people can actually carry into life.</p>
            <p className="about-credo">Xiazi Says: Bold talk, never blind talk.</p>
            <p>The world moves like a tide. Do not let the noise carry you away. Eight important stories a day may be enough. Use the rest of your time to work, be with the people you love, step into the sun, and live well.</p>
          </>
        )}
      </div>

      {includePhilosophy ? (
        <section className="xiazi-life-philosophy">
          <span className="life-kicker">{isZh ? "我们的生命观" : "OUR VIEW OF LIFE"}</span>
          <h4>
            {isZh
              ? "生命不是用来证明自己的，而是用来认识、接纳、成为并活出自己。"
              : "Life is not for proving yourself. It is for knowing, accepting, becoming, and living as yourself."}
          </h4>
          <p className="life-intro">
            {isZh
              ? "真正的成长，不是把自己改造成某个标准答案，而是在变化中越来越诚实地看见自己，越来越从容地选择自己的活法。"
              : "Growth is not the work of turning yourself into a standard answer. It is learning to see yourself more honestly through change, and to choose your way of living with greater ease."}
          </p>
          <div className="life-path" aria-label={isZh ? "生命路径" : "Life path"}>
            {path.map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
            ))}
          </div>
          <div className="life-principles">
            {principles.map(([name, description]) => (
              <article key={name}><strong>{name}</strong><p>{description}</p></article>
            ))}
          </div>
          <blockquote>{isZh ? "向内认识自己，向外如水而行。" : "Know yourself within; move through the world like water."}</blockquote>
          <p className="life-vision">
            {isZh
              ? "我们愿陪伴彼此走过低谷与高峰，探索身心健康的工作与生活方式；真实面对自己与世界，善待自己、他人与生命，并在创造和欣赏中活出生命之美。"
              : "We hope to accompany one another through valleys and peaks, exploring healthier ways to work and live: facing self and world truthfully, treating life with kindness, and creating and appreciating beauty."}
          </p>
        </section>
      ) : null}
    </>
  );
}

export function AboutSection({ locale }: { locale: AppLocale }) {
  const isZh = locale === "zh";

  return (
    <section id="about" className="about-section">
      <div className="shell">
        <header>
          <span>{isZh ? "关于我们" : "ABOUT US"}</span>
        </header>
        <AboutCopy locale={locale} />
      </div>
    </section>
  );
}
