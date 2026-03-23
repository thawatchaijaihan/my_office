import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { HeroCards } from "./HeroCards";

export const Hero = () => {
  return (
    <section className="container grid lg:grid-cols-2 place-items-center py-20 md:py-32 gap-10">
      <div className="text-center lg:text-start space-y-6">
        <main className="text-5xl md:text-6xl font-bold">
          <h1 className="inline">
            <span className="inline bg-gradient-to-r from-[#F596D3]  to-[#D247BF] text-transparent bg-clip-text">
              หมู่การข่าว
            </span>{" "}
            ยินดีต้อนรับ
          </h1>{" "}
          <br />
          <h2 className="inline text-4xl md:text-5xl">
            <span className="inline bg-gradient-to-r from-[#61DAFB] via-[#1fc0f1] to-[#03a3d7] text-transparent bg-clip-text">
              ป.71 พัน.713
            </span>
          </h2>
        </main>

        <p className="text-xl text-muted-foreground md:w-10/12 mx-auto lg:mx-0">
          ระบบเทคโนโลยีสารสนเทศเพื่อการจัดการฐานข้อมูลและสนับสนุนการปฏิบัติงาน 
          พัฒนาขึ้นเพื่อความรวดเร็วและแม่นยำในการวิเคราะห์ข้อมูล
        </p>

        <div className="space-y-4 md:space-y-0 md:space-x-4">
          <Button className="w-full md:w-1/3">เริ่มต้นใช้งาน</Button>

          <a
            href="/login"
            className={`w-full md:w-1/3 ${buttonVariants({
              variant: "outline",
            })}`}
          >
            เข้าสู่ระบบ
          </a>
        </div>
      </div>

      {/* Hero cards sections */}
      <div className="z-10">
        <HeroCards />
      </div>

      {/* Shadow effect */}
      <div className="shadow"></div>
    </section>
  );
};
