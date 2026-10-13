import AppKit
import CoreText
let root = FileManager.default.currentDirectoryPath
let source = root + "/store/creative-2026-10"
let out = source + "/readability-v2"
try! FileManager.default.createDirectory(atPath:out,withIntermediateDirectories:true)
for name in ["400Regular/PixelifySans_400Regular.ttf","700Bold/PixelifySans_700Bold.ttf"] { CTFontManagerRegisterFontsForURL(URL(fileURLWithPath:root+"/node_modules/@expo-google-fonts/pixelify-sans/"+name) as CFURL,.process,nil) }
func color(_ h:UInt32)->NSColor { NSColor(red:CGFloat((h>>16)&255)/255,green:CGFloat((h>>8)&255)/255,blue:CGFloat(h&255)/255,alpha:1) }
let cream:UInt32=0xFFF3D8, green:UInt32=0x254832, brown:UInt32=0x392414, gold:UInt32=0xD89B45
func box(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat,_ c:UInt32,_ radius:CGFloat=0){color(c).setFill();NSBezierPath(roundedRect:NSRect(x:x,y:y,width:w,height:h),xRadius:radius,yRadius:radius).fill()}
func text(_ s:String,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ size:CGFloat,_ c:UInt32=0x254832,_ pixel:Bool=true,_ center:Bool=false){let p=NSMutableParagraphStyle();p.alignment=center ? .center : .left;p.lineSpacing=0;let f=pixel ? NSFont.systemFont(ofSize:size,weight:.bold) : NSFont.systemFont(ofSize:size,weight:.medium);(s as NSString).draw(in:NSRect(x:x,y:y,width:w,height:600),withAttributes:[.font:f,.foregroundColor:color(c),.paragraphStyle:p])}
func picture(_ path:String,_ rect:NSRect){NSGraphicsContext.current?.imageInterpolation = .none;NSImage(contentsOfFile:path)!.draw(in:rect,from:.zero,operation:.sourceOver,fraction:1,respectFlipped:true,hints:nil)}
func render(_ file:String,_ w:Int,_ h:Int,_ draw:()->Void){let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:w,pixelsHigh:h,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:w*4,bitsPerPixel:32)!;NSGraphicsContext.saveGraphicsState();let context=NSGraphicsContext(bitmapImageRep:rep)!;NSGraphicsContext.current=NSGraphicsContext(cgContext:context.cgContext,flipped:true);let t=NSAffineTransform();t.translateX(by:0,yBy:CGFloat(h));t.scaleX(by:1,yBy:-1);t.concat();draw();NSGraphicsContext.restoreGraphicsState();try! rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:out+"/"+file));print(file)}
func phone(_ file:String,_ capture:String,_ title:String,_ sub:String){render(file,1206,2622){
    box(0,0,1206,2622,cream);box(0,0,1206,16,gold)
    text("STARDEW PLANNER",72,66,1062,30,green,false,true)
    text(title,72,150,1062,94,green,true,true)
    text(sub,90,394,1026,38,brown,false,true)
    box(138.5,550,929,1992,brown,38)
    picture(source+"/captures/"+capture,NSRect(x:150.5,y:562,width:905,height:1968))
}}
phone("iphone-01-dream-farm.png","iphone-garden.png","Design your\ndream farm","Your ideas. A world of possibilities.")
phone("iphone-02-touch.png","iphone-controls.png","Made for your\nfingertips","Place, paint, move. Undo and try again.")
phone("iphone-03-interiors.png","iphone-interior.png","Make the inside\nyours, too","Decorate homes, sheds and more.")
if FileManager.default.fileExists(atPath:source+"/captures/iphone-library.png"){phone("iphone-04-import.png","iphone-library.png","Bring your\nfarm with you","Import your save. Keep the original safe.")}
// Original layouts built using unmodified app renders and native captures.
render("header.png",3840,1646){box(0,0,3840,1646,green);picture(source+"/renders/marigold.png",NSRect(x:0,y:-737,width:3840,height:3120));box(1090,492,1660,650,cream,36);box(1130,532,1580,570,green,22);text("Design your\ndream farm",1160,587,1520,165,cream,true,true);text("STARDEW PLANNER",1200,967,1440,48,cream,false,true)}
render("search.png",3840,2560){box(0,0,3840,2560,cream);box(0,0,3840,35,gold);text("Design your dream farm",390,270,3060,178,green,true,true);text("Plan outside. Decorate inside.",390,500,3060,65,brown,false,true);picture(source+"/renders/marigold.png",NSRect(x:640,y:680,width:2560,height:2080));box(2460,1550,910,880,brown,22);picture(source+"/renders/cafe.png",NSRect(x:2480,y:1570,width:870,height:779))}
func tablet(_ file:String,_ capture:String,_ title:String,_ sub:String){render(file,2732,2048){box(0,0,2732,2048,cream);box(0,0,2732,22,gold);text("STARDEW PLANNER · ON iPAD",120,74,2492,38,green,false,true);text(title,110,140,2512,124,green,true,true);text(sub,110,315,2512,44,brown,false,true);box(308,449,2116,1589,brown,32);picture(source+"/captures/"+capture,NSRect(x:320,y:461,width:2092,height:1565));}}
tablet("ipad-01-dream-farm.png","ipad-garden.png","Design your dream farm","Your ideas. A world of possibilities.")
tablet("ipad-02-touch.png","ipad-garden.png","Made for your fingertips","Place, paint, move. Undo and try again.")
tablet("ipad-03-interiors.png","ipad-interior.png","Make the inside yours, too","Decorate homes, sheds and more.")
tablet("ipad-04-import.png","ipad-samples.png","Bring your farm with you","Import your save. Keep the original safe.")

tablet("ipad-05-inspiration.png","ipad-samples.png","Get inspired. Make it yours.","Start with a sample farm and customize it.")
tablet("ipad-06-coverage.png","ipad-coverage.png","Every tile covered","Sprinkler, Junimo Hut & scarecrow ranges.")

phone("iphone-05-inspiration.png","iphone-samples.png","Get inspired.\nMake it yours.","Start with a sample farm and customize it.")

phone("iphone-06-coverage.png","iphone-coverage.png","Every tile\ncovered","Sprinkler, Junimo Hut & scarecrow ranges.")
