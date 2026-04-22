# ============
# Colour v0.2
package OpenInnovations::Colour;

use strict;
use warnings;
use Data::Dumper;
use List::Util qw( min max );
use Scalar::Util qw(looks_like_number);


sub new {
	my ($class, %args) = @_;
	my $self = \%args;
	if($self->{'colour'}){
		$self = colour($self,$self->{'colour'},$self->{'name'});
	}
	bless $self, $class;
	return $self;
}

sub colour {

	my ($self, $c, $n) = @_;
	my (@bits,$r);
	
	$self->{'alpha'} = 1;
	$self->{'hex'} = "";
	$self->{'rgb'} = [0,0,0];

	# Let's deal with a variety of input
	if($c =~ /^\#/){
		$self->{'hex'} = $c;
		$self->{'rgb'} = [h2d(substr($c,1,2)),h2d(substr($c,3,2)),h2d(substr($c,5,2))];
	}elsif($c =~ /^rgb/){
		$c =~ s/[^\d\,]//g;
		@bits = split(',',$c);
		$n = @bits;
		if($n == 4){
			$self->{'alpha'} = $bits[3];
		}
		if($n >= 3){
			$self->{'rgb'} = [int($bits[0]),int($bits[1]),int($bits[2])];
		}
		$self->{'hex'} = "#".d2h($self->{'rgb'}[0]).d2h($self->{'rgb'}[1]).d2h($self->{'rgb'}[2]);
	}else{
		return $self;
	}

	$self->{'hsv'} = rgb2hsv($self->{'rgb'}[0],$self->{'rgb'}[1],$self->{'rgb'}[2]);
	$self->{'name'} = ($n || "Name");
	$self->{'text'} = ($self->{'rgb'}[0]*0.299 + $self->{'rgb'}[1]*0.587 + $self->{'rgb'}[2]*0.114 > 186 ? "black":"white");
 
	return $self;
}

sub d2h {
	my $c = sprintf("%02X", $_[0]);
	return $c;
}

sub h2d {
	return hex($_[0]);
}

sub rgb2hsv {
	my ($r, $g, $b) = @_;
	my ($min,$max,$h,$s,$v,$d);

	# Converts an RGB color value to HSV. Conversion formula
	# adapted from http://en.wikipedia.org/wiki/HSV_color_space.
	# Assumes r, g, and b are contained in the set [0, 255] and
	# returns h, s, and v in the set [0, 1].
	#
	# @param	Number  r		 The red color value
	# @param	Number  g		 The green color value
	# @param	Number  b		 The blue color value
	# @return  Array			  The HSV representation
	$r /= 255;
	$g /= 255;
	$b /= 255;
	$max = max([$r, $g, $b]);
	$min = min([$r, $g, $b]);
	$v = $max;
	$d = $max - $min;
	$s = ($max == 0) ? 0 : $d / $max;
	$h = 0;
	if($max == $min){
		$h = 0; # achromatic
	}else{
		if($max eq "r"){ $h = ($g - $b) / $d + ($g < $b ? 6 : 0); }
		elsif($max eq "g"){ $h = ($b - $r) / $d + 2; }
		elsif($max eq "b"){ $h = ($r - $g) / $d + 4; }
		$h /= 6;
	}
	return [$h, $s, $v];
}
# Convert to sRGB colorspace
# https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
sub sRGBToLinear {
	my $v = shift;
	if(!looks_like_number($v)){
		warning("Bad number <green>".($v||"")."<none>\n");
		return 0;
	}else{
		$v /= 255;
		if($v <= 0.03928){ return $v/12.92; }
		else { return (($v+0.055)/1.055)**2.4; }
	}
}

# https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
sub relativeLuminance {
	my @rgb = @_;
	return 0.2126 * sRGBToLinear($rgb[0]) + 0.7152 * sRGBToLinear($rgb[1]) + 0.0722 * sRGBToLinear($rgb[2]);
}

# https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-contrast.html#contrast-ratiodef
sub contrastRatio {
	my @c = @_;
	my $L1 = relativeLuminance($c[0],$c[1],$c[2]);
	my $L2 = relativeLuminance($c[3],$c[4],$c[5]);
	if($L1 < $L2){
		my $temp = $L2;
		$L2 = $L1;
		$L1 = $temp;
	}
	return ($L1 + 0.05) / ($L2 + 0.05);
}

sub contrastColour {
	my $c = shift;
	if(!defined($c)){
		return "black";
	}
	my @rgb = ();
	if(substr($c,0,1) eq '#'){
		@rgb = (hex(substr($c,1,2)),hex(substr($c,3,2)),hex(substr($c,5,2)));
	}else{
		warning("Can't parse colour $c\n");
#		var bits = c.match(/[0-9\.]+/g);
#		if(bits.length == 4) this.alpha = parseFloat(bits[3]);
#		rgb = [parseInt(bits[0]),parseInt(bits[1]),parseInt(bits[2])];
	}
	if(contrastRatio(@rgb,(0, 0, 0)) > contrastRatio(@rgb,(255, 255, 255))){
		return "black";
	}else{
		return "white";
	}
}

1;